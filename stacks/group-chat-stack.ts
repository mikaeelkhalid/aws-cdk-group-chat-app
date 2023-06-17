import { Stack, StackProps } from 'aws-cdk-lib';
import { CfnGraphQLApi, CfnGraphQLSchema } from 'aws-cdk-lib/aws-appsync';
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';

export class GroupChatStack extends Stack {
  public readonly groupChatGraphqlApi: CfnGraphQLApi;
  public readonly apiSchema: CfnGraphQLSchema;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // userpool and userpool client
    const userPool: UserPool = new UserPool(this, 'group-chat-userpool', {
      selfSignUpEnabled: true,
      accountRecovery: AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
    });

    const userPoolClient: UserPoolClient = new UserPoolClient(
      this,
      'group-chat-userpool-client',
      {
        userPool,
      }
    );

    // cloudWatch Role
    // give appsync permission to log to cloudwatch by assigning a role
    const cloudWatchRole = new Role(this, 'appsync-cloud-watch-logs', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
    });

    cloudWatchRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppSyncPushToCloudWatchLogs'
      )
    );

    // graphQL API
    this.groupChatGraphqlApi = new CfnGraphQLApi(
      this,
      'group-chat-graphql-api',
      {
        name: 'groupChat',
        authenticationType: 'API_KEY',

        additionalAuthenticationProviders: [
          {
            authenticationType: 'AMAZON_COGNITO_USER_POOLS',

            userPoolConfig: {
              userPoolId: userPool.userPoolId,
              awsRegion: 'us-east-1',
            },
          },
        ],
        userPoolConfig: {
          userPoolId: userPool.userPoolId,
          defaultAction: 'ALLOW',
          awsRegion: 'us-east-1',
        },

        logConfig: {
          fieldLogLevel: 'ALL',
          cloudWatchLogsRoleArn: cloudWatchRole.roleArn,
        },
        xrayEnabled: true,
      }
    );


    // graphql schema
    this.apiSchema = new CfnGraphQLSchema(this, 'group-chat-graphql-api-schema', {
      apiId: this.groupChatGraphqlApi.attrApiId,
      definition: readFileSync('./schema/schema.graphql').toString(),
    });
  }
}