import { Module } from '@nestjs/common';
import { IvfIndexService } from './ivf/ivf-index.service';
import { AnchoringService } from './anchoring/anchoring.service';
import { QueryService } from './query/query.service';
import { QueryController } from './query/query.controller';

@Module({
  controllers: [QueryController],
  providers: [IvfIndexService, AnchoringService, QueryService],
  // Anchor API anchors its document batches through the same (mock) contract.
  exports: [AnchoringService],
})
export class VerifiableSearchModule {}
