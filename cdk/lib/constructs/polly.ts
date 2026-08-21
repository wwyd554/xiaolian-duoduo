import { Construct } from 'constructs';

import { PollyLexiconCustomResource } from '../custom-resources/polly-lexicon';
import { sampleJapaneseLexicon, sampleEnglishLexicon } from '../custom-resources/polly-lexicon/sample-lexicon';


export interface PollyProps {
  envId: string;
}

export class Polly extends Construct {
  
  constructor(scope: Construct, id: string, props: PollyProps) {
    super(scope, id);

    // Amazon Polly Lexiconのカスタムリソースを作成
    const jaLexicon = new PollyLexiconCustomResource(this, 'JapaneseLexicon', {
      lexiconName: `${props.envId}ja`,
      lexiconContent: sampleJapaneseLexicon,
      resourceId: 'PollyJapaneseLexiconResource'
    });
    
    const enLexicon = new PollyLexiconCustomResource(this, 'EnglishLexicon', {
      lexiconName: `${props.envId}en`,
      lexiconContent: sampleEnglishLexicon,
      resourceId: 'PollyEnglishLexiconResource'
    });
    
  }
}
