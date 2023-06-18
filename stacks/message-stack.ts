import { Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver,
} from 'aws-cdk-lib/aws-appsync';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { readFileSync } from 'fs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';

interface MessageStackProps extends StackProps {
  groupChatGraphqlApi: CfnGraphQLApi;
  apiSchema: CfnGraphQLSchema;
  groupChatTable: Table;
  groupChatDatasource: CfnDataSource;
}

export class MessageStack extends Stack {
  constructor(scope: Construct, id: string, props: MessageStackProps) {
    super(scope, id, props);

    const {
      groupChatTable,
      groupChatGraphqlApi,
      apiSchema,
      groupChatDatasource,
    } = props;

    const signingProfile = new SigningProfile(this, 'signing-profile', {
      platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
    });

    const codeSigningConfig = new CodeSigningConfig(
      this,
      'code-signing-config',
      {
        signingProfiles: [signingProfile],
      }
    );

    const sendMessageLambda = new NodejsFunction(
      this,
      'message-lambda-handler',
      {
        tracing: Tracing.ACTIVE,
        codeSigningConfig,
        runtime: Runtime.NODEJS_16_X,
        handler: 'handler',
        entry: join(__dirname, 'lambdas/message', 'send-message-lambda.ts'),

        memorySize: 1024,
      }
    );

    const typingIndicatorLambda = new NodejsFunction(
      this,
      'typing-indicator-lambda-handler',
      {
        tracing: Tracing.ACTIVE,
        codeSigningConfig,
        runtime: Runtime.NODEJS_16_X,
        handler: 'handler',
        entry: join(__dirname, 'lambdas/message', 'typing-indicator-lambda.ts'),

        memorySize: 1024,
      }
    );

    sendMessageLambda.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppSyncPushToCloudWatchLogs'
      )
    );

    typingIndicatorLambda.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppSyncPushToCloudWatchLogs'
      )
    );

    const appsyncLambdaRole = new Role(this, 'lambda-role', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
    });

    appsyncLambdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess')
    );

    const lambdaDataSources: CfnDataSource = new CfnDataSource(
      this,
      'message-lambda-datasource',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        name: 'MessageLambdaDatasource',
        type: 'AWS_LAMBDA',

        lambdaConfig: {
          lambdaFunctionArn: sendMessageLambda.functionArn,
        },
        serviceRoleArn: appsyncLambdaRole.roleArn,
      }
    );

    const typingIndicatorDataSources: CfnDataSource = new CfnDataSource(
      this,
      'typing-indicator-data-sources',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        name: 'TypingIndicatorDataSources',
        type: 'AWS_LAMBDA',

        lambdaConfig: {
          lambdaFunctionArn: typingIndicatorLambda.functionArn,
        },
        serviceRoleArn: appsyncLambdaRole.roleArn,
      }
    );

    const sendMessageResolver: CfnResolver = new CfnResolver(
      this,
      'send-message-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Mutation',
        fieldName: 'sendMessage',
        dataSourceName: lambdaDataSources.attrName,
      }
    );

    const typingIndicatorResolver: CfnResolver = new CfnResolver(
      this,
      'typing-indicator-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Mutation',
        fieldName: 'typingIndicator',
        dataSourceName: typingIndicatorDataSources.attrName,
      }
    );

    const getResultMessagesPerGroupResolver: CfnResolver = new CfnResolver(
      this,
      'get-result-messages-per-group-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Query',
        fieldName: 'getAllMessagesPerGroup',
        dataSourceName: groupChatDatasource.name,
        requestMappingTemplate: readFileSync(
          './stacks/vtl/get_all_messages_per_group_request.vtl'
        ).toString(),

        responseMappingTemplate: readFileSync(
          './stacks/vtl/get_all_messages_per_group_response.vtl'
        ).toString(),
      }
    );

    const getUserPerMessageResolver: CfnResolver = new CfnResolver(
      this,
      'get-user-per-message-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Message',
        fieldName: 'user',
        dataSourceName: groupChatDatasource.name,
        requestMappingTemplate: readFileSync(
          './stacks/vtl/get_user_per_message_request.vtl'
        ).toString(),

        responseMappingTemplate: readFileSync(
          './stacks/vtl/get_user_per_message_response.vtl'
        ).toString(),
      }
    );

    sendMessageResolver.addDependsOn(apiSchema);
    typingIndicatorResolver.addDependsOn(apiSchema);
    getResultMessagesPerGroupResolver.addDependsOn(apiSchema);

    getUserPerMessageResolver.addDependsOn(getResultMessagesPerGroupResolver);

    groupChatTable.grantFullAccess(sendMessageLambda);
    groupChatTable.grantFullAccess(typingIndicatorLambda);

    sendMessageLambda.addEnvironment('GroupChat_DB', groupChatTable.tableName);
    typingIndicatorLambda.addEnvironment(
      'GroupChat_DB',
      groupChatTable.tableName
    );
  }
}

