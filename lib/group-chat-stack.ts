import { Stack, StackProps } from 'aws-cdk-lib';
import { AccountRecovery, UserPool, UserPoolClient, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class GroupChatStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // userpool and userpool client 
    const userPool: UserPool = new UserPool(
      this,
      "group-chat-userpool",
      {
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
      }
    );

    const userPoolClient: UserPoolClient = new UserPoolClient(
      this,
      "group-chat-userpool-client",
      {
        userPool,
      }
    );
  }
}
