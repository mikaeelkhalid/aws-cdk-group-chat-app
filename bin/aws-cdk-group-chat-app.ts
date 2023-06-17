#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsCdkGroupChatAppStack } from '../lib/aws-cdk-group-chat-app-stack';

const app = new cdk.App();

new AwsCdkGroupChatAppStack(app, 'aw-cdk-group-chat-app-stack', {
  env: { account: "xxxxxxxxxxxx", region: "us-east-1" }, // update aws account and region
});