import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';
import { Construct } from 'constructs';

export class RobotincStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'RobotincVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
      ]
    });

    const agentRepository = new ecr.Repository(this, 'AgentRepository', {
      repositoryName: 'robotinc-edge-agent',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true
    });

    const agentImage = new ecrAssets.DockerImageAsset(this, 'AgentImage', {
      directory: path.join(__dirname, '../../../components/edge-agent'),
      platform: ecrAssets.Platform.LINUX_ARM64
    });

    const componentVersion = '1.0.4';
    const componentName = 'com.robotinc.EdgeAgent';

    const componentRecipe = {
      RecipeFormatVersion: '2020-01-25',
      ComponentName: componentName,
      ComponentVersion: componentVersion,
      ComponentDescription: 'Robotinc Edge AI Agent',
      ComponentPublisher: 'Robotinc',
      ComponentConfiguration: {
        DefaultConfiguration: {
          accessControl: {
            'aws.greengrass.ipc.mqttproxy': {
              [`${componentName}:mqttproxy:1`]: {
                policyDescription: 'Allows access to publish/subscribe to IoT Core',
                operations: ['aws.greengrass#PublishToIoTCore', 'aws.greengrass#SubscribeToIoTCore'],
                resources: ['*']
              }
            }
          }
        }
      },
      Manifests: [{
        Platform: { os: 'linux', architecture: 'aarch64' },
        Lifecycle: {
          Install: {
            Script: [
              `HOME=/tmp aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${agentImage.imageUri.split('/')[0]}`,
              `docker pull ${agentImage.imageUri}`,
              `echo "Agent image ready. Run 'agent' command to start."`
            ].join(' && ')
          }
        }
      }]
    };

    const greengrassComponent = new cdk.CfnResource(this, 'GreengrassComponent', {
      type: 'AWS::GreengrassV2::ComponentVersion',
      properties: {
        InlineRecipe: JSON.stringify(componentRecipe)
      }
    });

    const deploymentBucket = new s3.Bucket(this, 'DeploymentBucket', {
      bucketName: `robotinc-deployment-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const deviceStateTable = new dynamodb.Table(this, 'DeviceStateTable', {
      tableName: 'robotinc-device-states',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    deviceStateTable.addGlobalSecondaryIndex({
      indexName: 'LatestStateIndex',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'isLatest', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new ec2.InterfaceVpcEndpoint(this, 'IoTDataEndpoint', {
      vpc, service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.iot.data`)
    });
    new ec2.InterfaceVpcEndpoint(this, 'IoTCredentialEndpoint', {
      vpc, service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.iot.credentials`)
    });
    new ec2.InterfaceVpcEndpoint(this, 'GreengrassDataEndpoint', {
      vpc, service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.greengrass`)
    });
    new ec2.GatewayVpcEndpoint(this, 'DynamoDBEndpoint', {
      vpc, service: ec2.GatewayVpcEndpointAwsService.DYNAMODB
    });
    new ec2.GatewayVpcEndpoint(this, 'S3Endpoint', {
      vpc, service: ec2.GatewayVpcEndpointAwsService.S3
    });
    new ec2.InterfaceVpcEndpoint(this, 'SSMEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.SSM
    });
    new ec2.InterfaceVpcEndpoint(this, 'SSMMessagesEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES
    });
    new ec2.InterfaceVpcEndpoint(this, 'EC2MessagesEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
    });
    new ec2.InterfaceVpcEndpoint(this, 'ECRApiEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.ECR
    });
    new ec2.InterfaceVpcEndpoint(this, 'ECRDockerEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
    });
    new ec2.InterfaceVpcEndpoint(this, 'STSEndpoint', {
      vpc, service: ec2.InterfaceVpcEndpointAwsService.STS
    });
    new ec2.InterfaceVpcEndpoint(this, 'BedrockRuntimeEndpoint', {
      vpc, service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-runtime`)
    });

    const greengrassRole = new iam.Role(this, 'GreengrassEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
      inlinePolicies: {
        GreengrassAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['iot:*', 'greengrass:*'],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:Query', 'dynamodb:GetItem'],
              resources: [deviceStateTable.tableArn]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: [`${deploymentBucket.bucketArn}/*`, deploymentBucket.bucketArn]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['iam:CreateRole', 'iam:AttachRolePolicy', 'iam:GetRole', 'iam:PassRole', 'iam:GetPolicy'],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: ['*']
            })
          ]
        })
      }
    });

    const greengrassSecurityGroup = new ec2.SecurityGroup(this, 'GreengrassSecurityGroup', {
      vpc,
      description: 'Security group for Greengrass EC2 instance',
      allowAllOutbound: true
    });

    const greengrassInstance = new ec2.Instance(this, 'GreengrassInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: greengrassSecurityGroup,
      role: greengrassRole,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      blockDevices: [{ deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(20, { encrypted: true }) }],
      requireImdsv2: true,
      userData: ec2.UserData.forLinux()
    });

    greengrassInstance.userData.addCommands(
      '#!/bin/bash',
      'set -e',
      'yum update -y',
      'yum install -y python3 python3-pip docker git unzip java-17-amazon-corretto-headless',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -a -G docker ec2-user',
      'usermod -a -G docker ssm-user || true',
      'groupadd --system ggc_group || true',
      'useradd --system --gid ggc_group ggc_user || true',
      'usermod -a -G docker ggc_user',
      `echo '#!/bin/bash' > /usr/local/bin/agent`,
      `echo 'aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${agentImage.imageUri.split('/')[0]}' >> /usr/local/bin/agent`,
      `echo 'docker run -it --rm --network host -e AWS_REGION=${this.region} ${agentImage.imageUri}' >> /usr/local/bin/agent`,
      'chmod +x /usr/local/bin/agent',
      `echo '#!/bin/bash' > /usr/local/bin/agent-verbose`,
      `echo 'aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${agentImage.imageUri.split('/')[0]}' >> /usr/local/bin/agent-verbose`,
      `echo 'docker run -it --rm --network host -e AWS_REGION=${this.region} -e VERBOSE=true ${agentImage.imageUri}' >> /usr/local/bin/agent-verbose`,
      'chmod +x /usr/local/bin/agent-verbose',
      'cd /tmp',
      'curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-nucleus-latest.zip -o greengrass-nucleus-latest.zip',
      'unzip -o greengrass-nucleus-latest.zip -d GreengrassInstaller',
      `sudo -E java -Droot="/greengrass/v2" -Dlog.store=FILE -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region ${this.region} --thing-name robotinc-greengrass-core --thing-group-name robotinc-cores --component-default-user ggc_user:ggc_group --provision true --setup-system-service true --deploy-dev-tools true`,
      'echo "Greengrass setup completed"'
    );

    cdk.Tags.of(greengrassInstance).add('Greengrass', 'true');

    const greengrassDeployment = new cdk.CfnResource(this, 'GreengrassDeployment', {
      type: 'AWS::GreengrassV2::Deployment',
      properties: {
        TargetArn: `arn:aws:iot:${this.region}:${this.account}:thinggroup/robotinc-cores`,
        DeploymentName: 'RobotincAgentDeployment',
        Components: {
          [componentName]: {
            ComponentVersion: componentVersion
          }
        }
      }
    });

    greengrassDeployment.node.addDependency(greengrassComponent);



    const stateProcessor = new lambda.Function(this, 'StateProcessor', {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'index.handler',
      environment: { DEFAULT_DEVICE_ID: 'robotinc-m5stick-001' },
      code: lambda.Code.fromInline(`import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('robotinc-device-states')

def handler(event, context):
    try:
        device_id = event.get('deviceId', os.environ.get('DEFAULT_DEVICE_ID', 'unknown'))
        timestamp = datetime.utcnow().isoformat()
        table.put_item(Item={'deviceId': device_id, 'timestamp': timestamp, 'state': event})
        table.put_item(Item={'deviceId': device_id, 'timestamp': 'LATEST', 'isLatest': 'true', 'state': event, 'lastUpdated': timestamp})
        return {'statusCode': 200}
    except Exception as e:
        print(f'Error: {str(e)}')
        return {'statusCode': 500}`)
    });

    deviceStateTable.grantWriteData(stateProcessor);

    new iot.CfnTopicRule(this, 'DeviceStateRule', {
      ruleName: 'robotinc_device_state_capture',
      topicRulePayload: {
        sql: "SELECT * FROM '+/+/status/+'",
        actions: [{ lambda: { functionArn: stateProcessor.functionArn } }]
      }
    });

    stateProcessor.addPermission('IoTInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      action: 'lambda:InvokeFunction'
    });

    new cdk.CfnOutput(this, 'AgentImageUri', { value: agentImage.imageUri });
    new cdk.CfnOutput(this, 'AgentRepositoryUri', { value: agentRepository.repositoryUri });
    new cdk.CfnOutput(this, 'DeploymentBucketOutput', { value: deploymentBucket.bucketName });
    new cdk.CfnOutput(this, 'InstanceIdOutput', { value: greengrassInstance.instanceId });
    new cdk.CfnOutput(this, 'DeviceStateTableOutput', { value: deviceStateTable.tableName });
  }
}