import { Module } from '@nestjs/common';
import { PosController } from './controllers/pos.controller';
import { PosPublicController } from './controllers/pos-public.controller';
import { FnbOperationsController } from './controllers/operations.controller';
import { PosOrderService } from './services/pos-order.service';
import { PosInventoryService } from './services/pos-inventory.service';
import { FnbOperationsService } from './services/fnb-operations.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [PosController, PosPublicController, FnbOperationsController],
  providers: [PosOrderService, PosInventoryService, FnbOperationsService],
  exports: [PosOrderService, PosInventoryService, FnbOperationsService],
})
export class FnbModule {}
