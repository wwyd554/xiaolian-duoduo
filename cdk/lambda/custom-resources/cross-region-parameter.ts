import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

/**
 * クロスリージョンパラメータ取得のためのLambda関数
 * 
 * このLambda関数は、指定されたリージョンからSSMパラメータを取得するためのカスタムリソースとして機能します。
 * CloudFrontとWAF Web ACLの連携において、us-east-1リージョンに作成されたWAF Web ACLのARNを
 * 他のリージョンから取得するために使用されます。
 */
export async function handler(event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceResponse> {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { RequestType, ResourceProperties, StackId, RequestId, LogicalResourceId } = event;
  const { parameterName, region } = ResourceProperties;
  
  // レスポンスの基本構造を作成
  const response: CloudFormationCustomResourceResponse = {
    Status: 'SUCCESS',
    PhysicalResourceId: (event as any).PhysicalResourceId || `cross-region-parameter-${parameterName}-${region}`,
    StackId,
    RequestId,
    LogicalResourceId,
    Data: {},
  };
  
  try {
    // Delete操作の場合は何もせずに成功を返す
    if (RequestType === 'Delete') {
      return response;
    }
    
    // パラメータ名とリージョンが指定されていることを確認
    if (!parameterName || !region) {
      throw new Error('未指定参数名或区域。');
    }
    
    // 指定されたリージョンのSSMクライアントを作成
    const ssmClient = new SSMClient({ region });
    
    // SSMパラメータを取得
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });
    
    const result = await ssmClient.send(command);
    
    // パラメータ値をレスポンスに設定
    if (result.Parameter && result.Parameter.Value) {
      response.Data = {
        Value: result.Parameter.Value,
        Type: result.Parameter.Type,
        Version: result.Parameter.Version,
        ARN: result.Parameter.ARN,
      };
    } else {
      throw new Error(`未找到参数 ${parameterName} 的值。`);
    }
    
    return response;
  } catch (error) {
    console.error('エラー:', error);
    
    // エラーの種類に応じたメッセージを設定
    let errorMessage = '未知のエラーが発生しました。';
    if (error instanceof Error) {
      if (error.name === 'ParameterNotFound') {
        errorMessage = `パラメータが見つかりません: ${parameterName}`;
      } else if (error.name === 'AccessDeniedException') {
        errorMessage = `SSMパラメータへのアクセスが拒否されました: ${parameterName}`;
      } else {
        errorMessage = error.message;
      }
    }
    
    // エラー情報をレスポンスに設定
    const errorResponse: CloudFormationCustomResourceResponse = {
      ...response,
      Status: 'FAILED',
      Reason: errorMessage,
    };
    
    return errorResponse;
  }
}
