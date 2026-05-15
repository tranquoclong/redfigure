import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { SearchService } from './search.service';
import { SearchIndexer } from './search.indexer';
import { SearchController } from './search.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [
    {
      provide: 'ELASTICSEARCH_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Client({
          node:
            configService.get<string>('ELASTICSEARCH_URL') ??
            'http://localhost:9200',
          auth: {
            apiKey: configService.get<string>('ELASTIC_API_KEY') || '',
          },
          requestTimeout: 30000,
          maxRetries: 3,
        });
      },
    },
    {

      provide: 'ELASTICSEARCH_INDEX_NAME',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const prefix =
          configService.get<string>('ELASTICSEARCH_INDEX_PREFIX') ?? '';
        return `${prefix}products`;
      },
    },
    SearchService,
    SearchIndexer,
  ],
  exports: [SearchService, SearchIndexer],
})
export class SearchModule { }
