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

interface GroupLambdaStackProps extends StackProps {
  groupChatGraphqlApi: CfnGraphQLApi;
  apiSchema: CfnGraphQLSchema;
  groupChatTable: Table;
  groupChatDatasource: CfnDataSource;
}

export class GroupLamdaStack extends Stack {
  constructor(scope: Construct, id: string, props: GroupLambdaStackProps) {
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

    const createGroupLambda = new NodejsFunction(this, 'group-lambda-handler', {
      tracing: Tracing.ACTIVE,
      codeSigningConfig,
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      entry: join(__dirname, 'lambdas/group', 'create-group-lambda.ts'),

      memorySize: 1024,
    });
    createGroupLambda.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppSyncPushToCloudWatchLogs'
      )
    );

    const addUserToGroupLambda = new NodejsFunction(
      this,
      'add-user-to-group-lambda-handler',
      {
        tracing: Tracing.ACTIVE,
        codeSigningConfig,
        runtime: Runtime.NODEJS_16_X,
        handler: 'handler',
        entry: join(__dirname, 'lambdas/group', 'add-user-to-group-lambda.ts'),

        memorySize: 1024,
      }
    );
    addUserToGroupLambda.role?.addManagedPolicy(
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
      'group-lambda-datasource',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        name: 'GroupLambdaDatasource',
        type: 'AWS_LAMBDA',

        lambdaConfig: {
          lambdaFunctionArn: createGroupLambda.functionArn,
        },
        serviceRoleArn: appsyncLambdaRole.roleArn,
      }
    );

    const addUserToGroupDataSources: CfnDataSource = new CfnDataSource(
      this,
      'add-user-to-group-lambda-datasource',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        name: 'AddUserToGroupLambdaDatasource',
        type: 'AWS_LAMBDA',

        lambdaConfig: {
          lambdaFunctionArn: addUserToGroupLambda.functionArn,
        },
        serviceRoleArn: appsyncLambdaRole.roleArn,
      }
    );

    const createGroupResolver: CfnResolver = new CfnResolver(
      this,
      'create-group-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Mutation',
        fieldName: 'createGroup',
        dataSourceName: lambdaDataSources.attrName,
      }
    );

    const addUserToGroupResolver: CfnResolver = new CfnResolver(
      this,
      'add-user-to-group-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Mutation',
        fieldName: 'addUserToGroup',
        dataSourceName: addUserToGroupDataSources.attrName,
      }
    );

    const getGroupsCreatedByUserResolver: CfnResolver = new CfnResolver(
      this,
      'get-groups-created-by-user-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Query',
        fieldName: 'getAllGroupsCreatedByUser',
        dataSourceName: groupChatDatasource.name,
        requestMappingTemplate: readFileSync(
          './stacks/vtl/get_groups_created_by_user_request.vtl'
        ).toString(),

        responseMappingTemplate: readFileSync(
          './stacks/vtl/get_groups_created_by_user_response.vtl'
        ).toString(),
      }
    );

    const getGroupsUserBelongsToResolver: CfnResolver = new CfnResolver(
      this,
      'get-all-groups-user-belongs-to',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'Query',
        fieldName: 'getGroupsUserBelongsTo',
        dataSourceName: groupChatDatasource.name,
        requestMappingTemplate: readFileSync(
          './stacks/vtl/get_groups_user_belongs_to_request.vtl'
        ).toString(),

        responseMappingTemplate: readFileSync(
          './stacks/vtl/get_groups_user_belongs_to_response.vtl'
        ).toString(),
      }
    );

    const getGroupResolver: CfnResolver = new CfnResolver(
      this,
      'get-group-resolver',
      {
        apiId: groupChatGraphqlApi.attrApiId,
        typeName: 'UserGroup',
        fieldName: 'group',
        dataSourceName: groupChatDatasource.name,
        requestMappingTemplate: readFileSync(
          './stacks/vtl/get_group_request.vtl'
        ).toString(),

        responseMappingTemplate: readFileSync(
          './stacks/vtl/get_group_response.vtl'
        ).toString(),
      }
    );

    createGroupResolver.addDependsOn(apiSchema);
    addUserToGroupResolver.addDependsOn(apiSchema);
    getGroupsCreatedByUserResolver.addDependsOn(apiSchema);
    getGroupsUserBelongsToResolver.addDependsOn(apiSchema);
    getGroupResolver.addDependsOn(getGroupsUserBelongsToResolver);
    groupChatTable.grantFullAccess(createGroupLambda);
    groupChatTable.grantFullAccess(addUserToGroupLambda);
    createGroupLambda.addEnvironment('GroupChat_DB', groupChatTable.tableName);
  }
}

