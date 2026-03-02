from strands import Agent
from strands.tools import tool
from strands.models.bedrock import BedrockModel
import json
import boto3
import os
import re
import sys
from colour import Color

# Get AWS region from environment
AWS_REGION = os.environ.get('AWS_REGION', 'eu-west-2')
VERBOSE = '-v' in sys.argv or '--verbose' in sys.argv

# Get IoT endpoint
iot_control = boto3.client('iot', region_name=AWS_REGION)
iot_endpoint = iot_control.describe_endpoint(endpointType='iot:Data-ATS')['endpointAddress']

if VERBOSE:
    print(f"[INIT] Using IoT endpoint: {iot_endpoint}")
    print(f"[INIT] Region: {AWS_REGION}")

# IoT and DynamoDB clients
iot_client = boto3.client('iot-data', endpoint_url=f'https://{iot_endpoint}', region_name=AWS_REGION)
session = boto3.Session(profile_name='iot') if os.path.exists(os.path.expanduser('~/.aws/config')) else boto3.Session()
dynamodb = session.resource('dynamodb', region_name=AWS_REGION)
device_table = dynamodb.Table('robotinc-device-states')

bedrock_model = BedrockModel(
    model_id="amazon.nova-lite-v1:0",
    streaming=False,
    temperature=0.3,
    top_p=0.9
)

def send_mqtt_command(color_data: dict, device_name: str = "robotinc-m5stick-001") -> str:
    """Send MQTT command to IoT Core"""
    message = {
        "action": "color",
        "r": color_data["r"],
        "g": color_data["g"],
        "b": color_data["b"]
    }
    
    topic = f'robotinc/device/command/{device_name}'
    
    try:
        payload = json.dumps(message, separators=(',', ':'))
        response = iot_client.publish(topic=topic, qos=0, payload=payload)
        
        if VERBOSE:
            print(f"Topic: {topic}")
            print(f"Payload: {payload}")
            print(f"Response: {response['ResponseMetadata']['HTTPStatusCode']}")
        
        return f"Changed device to {color_data['color']}"
    except Exception as e:
        return f"Error: {str(e)}"



@tool
def color_control(user_input: str) -> str:
    """Handle color commands with proper color conversion"""
    try:
        color_agent = Agent(
            model=bedrock_model,
            system_prompt="""You must return ONLY a single CSS/X11 color name, nothing else.
No explanations, no code, no extra text - just the color name.

Examples:
"turn it red" -> red
"color of the moon" -> gray  
"ocean" -> cyan
"sea" -> cyan
"sunset" -> orange"""
        )
        
        color_name = str(color_agent(user_input)).strip().strip('"').lower()
        # Extract just the first word if agent returns multiple words
        color_name = color_name.split()[0] if color_name else "blue"
        
        color = Color(color_name)
        r, g, b = [int(c * 255) for c in color.rgb]
        
        return send_mqtt_command({"color": color_name, "r": r, "g": g, "b": b})
        
    except ValueError as e:
        return f"Unknown color '{color_name}': {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def query_device(user_input: str) -> str:
    """Query device state - returns raw color history from DynamoDB"""
    try:
        response = device_table.query(
            KeyConditionExpression='deviceId = :deviceId',
            ExpressionAttributeValues={':deviceId': 'robotinc-m5stick-001'},
            ScanIndexForward=False,
            Limit=10
        )
        
        history = []
        for item in response['Items']:
            if item['timestamp'] != 'LATEST':
                status = item.get('state', {}).get('status', '')
                if 'RGB' in status:
                    history.append(f"{item['timestamp']}: {status}")
        
        return "\n".join(history) if history else "No color history found"
            
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def help_info(user_input: str = "") -> str:
    """Provide help information"""
    return """I can control your M5Stick IoT device:

• Change colors: "turn it red", "make it ocean blue"
• Check status: "what color is it?", "get status"  
• View history: "show history", "last 3 colors"

Try: "turn it sunset orange" or "what color is it?"""""

iot_agent = Agent(
    model=bedrock_model,
    system_prompt="""IoT device control agent. Route to tools:
- color_control: color changes
- query_device: status/history queries  
- help_info: help requests

Convert RGB to names: RGB(0,128,0)=green, RGB(255,192,202)=pink
Be concise.""",
    tools=[color_control, query_device, help_info]
)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  Robotinc IoT Edge Agent")
    print("  AI-Powered Device Control")
    print("="*60)
    print("\nCommands: 'turn red', 'get status', 'show history', 'quit'")
    if VERBOSE:
        print("\n[VERBOSE MODE ENABLED]")
    print("\n" + "-"*60 + "\n")
    
    while True:
        try:
            user_input = input("You: ").strip()
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\nShutting down agent...")
                break
            if user_input:
                response = str(iot_agent(user_input))
                response = re.sub(r'<thinking>.*?</thinking>', '', response, flags=re.DOTALL).strip()
                print(f"Agent: {response}\n")
        except KeyboardInterrupt:
            print("\n\nShutting down agent...")
            break
        except Exception as e:
            print(f"\nError: {str(e)}\n")