import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Amazon Polly Lexiconを管理するためのプロパティ
 */
export interface PollyLexiconCustomResourceProps {
  /**
   * Lexiconの名前
   */
  readonly lexiconName: string;

  /**
   * PLS形式のLexiconコンテンツ
   */
  readonly lexiconContent: string;

  /**
   * リソースの一意のID (オプション)
   */
  readonly resourceId: string;
}

/**
 * Amazon Polly Lexiconを管理するカスタムリソース
 * 
 * 作成: 新規Lexiconを登録
 * 更新: 既存Lexiconを削除して新規登録
 * 削除: Lexiconを削除
 */
export class PollyLexiconCustomResource extends Construct {
  /**
   * カスタムリソースのARN
   */
  public readonly customResourceArn: string;

  constructor(scope: Construct, id: string, props: PollyLexiconCustomResourceProps) {
    super(scope, id);

    // リソースIDの設定
    const resourceId = props.resourceId;

    // カスタムリソースの作成
    const lexiconCustomResource = new cr.AwsCustomResource(this, resourceId, {
      onCreate: {
        service: 'Polly',
        action: 'putLexicon',
        parameters: {
          Name: props.lexiconName,
          Content: props.lexiconContent
        },
        physicalResourceId: cr.PhysicalResourceId.of(resourceId)
      },
      onUpdate: {
        service: 'Polly',
        action: 'putLexicon',
        parameters: {
          Name: props.lexiconName,
          Content: props.lexiconContent
        },
        physicalResourceId: cr.PhysicalResourceId.of(resourceId)
      },
      onDelete: {
        service: 'Polly',
        action: 'deleteLexicon',
        parameters: {
          Name: props.lexiconName
        }
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            'polly:PutLexicon',
            'polly:GetLexicon', 
            'polly:DeleteLexicon',
            'polly:ListLexicons'
          ],
          resources: ['*']
        })
      ]),
      installLatestAwsSdk: true,
      serviceTimeout: cdk.Duration.minutes(5),
      timeout: cdk.Duration.minutes(4),
    });

    // カスタムリソースのARNを設定
    this.customResourceArn = lexiconCustomResource.getResponseField('ResponseMetadata.RequestId');
  }
}