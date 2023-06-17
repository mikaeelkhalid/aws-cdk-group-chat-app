#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GroupChatStack } from '../stacks/group-chat-stack';

const app = new cdk.App();

new GroupChatStack(app, 'aw-cdk-group-chat-app-stack', {
  env: { account: "xxxxxxxxxxxx", region: "us-east-1" }, // update aws account and region
});