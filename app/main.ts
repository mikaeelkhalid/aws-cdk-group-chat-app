#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GroupChatStack, UserLamdaStack } from '../stacks';

const app = new cdk.App();

const groupChatStack = new GroupChatStack(app, 'group-chat-stack', {
  env: { account: 'xxxxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
});

new UserLamdaStack(app, 'user-lambda-stack', {
  env: { account: 'xxxxxxxxxxxx', region: 'us-east-1' }, // update aws account and region
  groupChatTable: groupChatStack.groupChatTable,
  apiSchema: groupChatStack.apiSchema,
  groupChatGraphqlApi: groupChatStack.groupChatGraphqlApi,
});

