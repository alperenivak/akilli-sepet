import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { OpenFoodFactsService } from './openfoodfacts.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, OpenFoodFactsService],
  exports: [ProductsService, OpenFoodFactsService],
})
export class ProductsModule {}
