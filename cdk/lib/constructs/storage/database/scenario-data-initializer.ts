import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { ScenarioInitializer } from '../../../custom-resources/scenario-initializer/scenario-initializer';

/**
 * シナリオデータをDynamoDBに初期化するためのConstructのプロパティ
 */
export interface ScenarioDataInitializerProps {
  /**
   * シナリオデータを登録するDynamoDBテーブル
   * Table または ITable のいずれかを受け付ける
   */
  scenariosTable: dynamodb.ITable;
}

/**
 * シナリオデータをDynamoDBに初期化するためのConstruct
 */
export class ScenarioDataInitializer extends Construct {
  constructor(scope: Construct, id: string, props: ScenarioDataInitializerProps) {
    super(scope, id);

    // シナリオ初期化リソースを作成（ファイルパスベースの実装に変更）
    new ScenarioInitializer(this, 'ScenarioInitializer', {
      scenariosTable: props.scenariosTable,
    });
  }
}
