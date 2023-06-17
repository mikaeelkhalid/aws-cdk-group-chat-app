import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { randomSync } from 'ksuid';

export const uuid = (): string => {
  return randomSync().string;
};

export const executeTransactWrite = async (
  params: DocumentClient.TransactWriteItemsInput,
  docClient: DocumentClient
): Promise<DocumentClient.TransactWriteItemsOutput> => {
  const transactionRequest = docClient.transactWrite(params);

  let cancellationReasons: any[];

  transactionRequest.on('extractError', (response) => {
    try {
      cancellationReasons = JSON.parse(
        response.httpResponse.body.toString()
      ).CancellationReasons;
    } catch (err) {
      console.error('Error extracting cancellation error', err);
    }
  });

  return new Promise((resolve, reject) => {
    transactionRequest.send((err, response) => {
      if (err) {
        console.error('Error performing transactWrite', {
          cancellationReasons,
          err,
        });
        return reject({
          cancellationReasons,
          err,
        });
      }
      return resolve(response);
    });
  });
};

