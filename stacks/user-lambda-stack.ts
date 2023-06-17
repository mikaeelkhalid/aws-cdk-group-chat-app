import { Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver,
} from 'aws-cdk-lib/aws-appsync';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import path = require('path');

interface UserLambdaStackProps extends StackProps {
  groupChatGraphqlApi: CfnGraphQLApi;
  apiSchema: CfnGraphQLSchema;
  groupChatTable: Table;
}

export class UserLamdaStack extends Stack {
  constructor(scope: Construct, id: string, props: UserLambdaStackProps) {
    super(scope, id, props);

    const { groupChatGraphqlApi, groupChatTable, apiSchema } = props;

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

    const userLambda = new NodejsFunction(this, 'group-chat-user-handler', {
      tracing: Tracing.ACTIVE,
      codeSigningConfig,
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      entry: path.join(
        __dirname,
        'lambdas/user',
        'create-user-accounts-lambda.ts'
      ),
      memorySize: 1024,
    });

    userLambda.role?.addManagedPolicy(
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
      'user-lambda-datasource',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        name: 'UserLambdaDatasource',
        type: 'AWS_LAMBDA',

        lambdaConfig: {
          lambdaFunctionArn: userLambda.functionArn,
        },
        serviceRoleArn: appsyncLambdaRole.roleArn,
      }
    );

    const createUserAccountResolver: CfnResolver = new CfnResolver(
      this,
      'create-user-account-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Mutation',
        fieldName: 'createUserAccount',
        dataSourceName: lambdaDataSources.attrName,
      }
    );

    createUserAccountResolver.addDependsOn(apiSchema);
    groupChatTable.grantFullAccess(userLambda);

    userLambda.addEnvironment('GroupChat_DB', groupChatTable.tableName);
  }
}

