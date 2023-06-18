#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import {
  GroupChatStack,
  UserLamdaStack,
  GroupLambdaStack,
  MessageStack,
} from '../stacks';

const app = new App();

const groupChatStack = new GroupChatStack(app, 'group-chat-stack', {
  env: { account: 'xxxxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
});

new UserLamdaStack(app, 'user-lambda-stack', {
  env: { account: 'xxxxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
  groupChatTable: groupChatStack.groupChatTable,
  apiSchema: groupChatStack.apiSchema,
  groupChatGraphqlApi: groupChatStack.groupChatGraphqlApi,
});

new GroupLambdaStack(app, 'group-lambda-stack', {
  env: { account: 'xxxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
  groupChatTable: groupChatStack.groupChatTable,
  apiSchema: groupChatStack.apiSchema,
  groupChatGraphqlApi: groupChatStack.groupChatGraphqlApi,
  groupChatDatasource: groupChatStack.groupChatTableDatasource,
});

new MessageStack(app, 'message-lambda-stack', {
  env: { account: 'xxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
  groupChatTable: groupChatStack.groupChatTable,
  apiSchema: groupChatStack.apiSchema,
  groupChatGraphqlApi: groupChatStack.groupChatGraphqlApi,
  groupChatDatasource: groupChatStack.groupChatTableDatasource,
});

