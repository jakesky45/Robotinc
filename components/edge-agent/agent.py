from strands import Agent
from strands.tools import tool
from strands.models.bedrock import BedrockModel
import json
import boto3
import os
from datetime import datetime, timezone
from colour import Color

import sys

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
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
device_table = dynamodb.Table('robotinc-device-states')

bedrock_model = BedrockModel(
    model_id="amazon.nova-lite-v1:0",
    streaming=False
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

def send_status_request(device_name: str = "robotinc-m5stick-001") -> str:
    """Send status request to IoT Core"""
    message = {
        "action": "get_status",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "deviceId": device_name
    }
    
    topic = f'robotinc/device/command/{device_name}'
    
    try:
        response = iot_client.publish(topic=topic, payload=json.dumps(message))
        if VERBOSE:
            print(f"Topic: {topic}")
            print(f"MQTT: {json.dumps(message)}")
            print(f"Response: {response['ResponseMetadata']['HTTPStatusCode']}")
        return f"Status request sent to {device_name}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def color_control(user_input: str) -> str:
    """Handle color commands with proper color conversion"""
    try:
        if VERBOSE:
            print("[AGENT] Processing color command")
        
        # Extract color name using LLM
        color_agent = Agent(
            model=bedrock_model,
            system_prompt="""<instructions>
Extract a valid CSS/X11 color name from user input that the Python colour library can parse.

<rules>
1. Return ONLY a valid color name that Python's colour library recognizes
2. Map descriptive phrases to actual color names (e.g., "sea" -> "cyan", "sky" -> "skyblue")
3. No explanations, no punctuation, no extra words
4. If multiple colors mentioned, return the first one
</rules>

<examples>
"turn it red" -> "red"
"make it blue" -> "blue"
"change to forest green" -> "forestgreen"
"set the color to hot pink" -> "hotpink"
"I want crimson" -> "crimson"
"ocean blue please" -> "cyan"
"colour of the sea" -> "cyan"
"sky color" -> "skyblue"
</examples>
</instructions>"""
        )
        
        color_name = str(color_agent(user_input)).strip().lower()
        
        # Convert color name to RGB using colour package
        color = Color(color_name)
        r, g, b = [int(c * 255) for c in color.rgb]
        
        color_data = {
            "color": color_name,
            "r": r,
            "g": g,
            "b": b
        }
        
        return send_mqtt_command(color_data)
        
    except ValueError as e:
        return f"Unknown color '{color_name}': {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def device_status(user_input: str) -> str:
    """Handle status requests"""
    try:
        if VERBOSE:
            print("[AGENT] Getting device status")
        return send_status_request()
    except Exception as e:
        return f"Error getting status: {str(e)}"

@tool
def device_history(user_input: str) -> str:
    """Get device color history from DynamoDB"""
    try:
        if VERBOSE:
            print("[AGENT] Getting device history")
        
        for device_id in ['robotinc-m5stick-001', 'unknown']:
            if VERBOSE:
                print(f"[DDB] Querying deviceId: {device_id}")
            
            response = device_table.query(
                KeyConditionExpression='deviceId = :deviceId',
                ExpressionAttributeValues={':deviceId': device_id},
                ScanIndexForward=False,
                Limit=5
            )
            
            if VERBOSE:
                print(f"[DDB] Found {len(response['Items'])} items")
            
            if response['Items']:
                history = []
                for item in response['Items']:
                    if 'state' in item and item['state']:
                        state = item['state']
                        timestamp = item['timestamp']
                        
                        if 'r' in state and 'g' in state and 'b' in state:
                            r = state['r']
                            g = state['g'] 
                            b = state['b']
                            history.append(f"{timestamp}: RGB({r}, {g}, {b})")
                
                if history:
                    return f"Recent history for {device_id}:\n" + "\n".join(history)
        
        return "No history found"
            
    except Exception as e:
        return f"Error accessing DynamoDB: {str(e)}"

@tool
def help_info(user_input: str = "") -> str:
    """Provide help information"""
    return """<capabilities>
I can change the colour of your M5Stick IoT device

<color_control>
  <description>Change device screen color using natural language</description>
  <examples>
    • "turn it red" or "make it blue"
    • "change to hot pink" or "set it to turquoise"
    • "I want forest green" or "switch to coral"
  </examples> 
</color_control>

<status_and_history>
  <status>
    • "get status" - Request current device state
    • "what colour is it?" - Check current colour
  </status>
  <history>
    • "show history" - View last 5 colour changes from DynamoDB
    • "past colours" - See previous states
  </history>
</status_and_history>

<architecture>
  <flow>
    Your command → AWS Bedrock (Nova Micro) extracts color → RGB conversion (Python colour library) → 
    MQTT message to AWS IoT Core → M5Stick device changes color → 
    Device status → Lambda → DynamoDB (automatic logging)
  </flow>
</architecture>

<try_these>
  • "turn it ocean blue"
  • "make it sunset orange"
</try_these>
</capabilities>"""

# Main IoT agent with XML-structured prompts
iot_agent = Agent(
    model=bedrock_model,
    system_prompt="""<instructions>
You are an IoT device control agent. Route user requests to the appropriate tool.

<routing_rules>
  <color_control>
    <triggers>"turn", "make", "change", "set", color names</triggers>
    <examples>"turn red", "make it blue", "change to green"</examples>
    <tool>color_control</tool>
  </color_control>
  
  <device_status>
    <triggers>"status", "what color", "current"</triggers>
    <examples>"get status", "what color is it?", "current state"</examples>
    <tool>device_status</tool>
  </device_status>
  
  <device_history>
    <triggers>"history", "past", "previous"</triggers>
    <examples>"show history", "past colors", "previous states"</examples>
    <tool>device_history</tool>
  </device_history>
  
  <help_info>
    <triggers>"help", "what can you do", "example"</triggers>
    <examples>"help", "what can you do?", "commands", "give me an example"</examples>
    <tool>help_info</tool>
  </help_info>
</routing_rules>

<critical_rule>
You MUST return ONLY the exact tool output. Do NOT add any commentary, explanations, or follow-up questions.
The tool output is complete and needs no additions.
</critical_rule>
</instructions>""",
    tools=[color_control, device_status, device_history, help_info]
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
                response = iot_agent(user_input)
                print(f"Agent: {response}\n")
        except KeyboardInterrupt:
            print("\n\nShutting down agent...")
            break
        except Exception as e:
            print(f"\nError: {str(e)}\n")