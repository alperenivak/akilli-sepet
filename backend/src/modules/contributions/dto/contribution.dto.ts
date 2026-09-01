import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SubmitBarcodeContributionDto {
  @IsString()
  productId: string;

  @IsString()
  @MinLength(8)
  code: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitMarketListingDto {
  @IsString()
  productId: string;

  @IsString()
  marketId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewContributionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class ListContributionsDto {
  @IsOptional()
  @IsString()
  type?: 'BARCODE' | 'MARKET_LISTING';

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
