import { Module } from '@nestjs/common';
import { ReaderModule } from './reader/reader.module';

@Module({
  imports: [ReaderModule],
})
export class AppModule {}
