// app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AppModule } from '../src/app/app.module';
import { timeout } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

describe('AppController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { port: 3000 },
    });
    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { port: 3000 },
    });
  });

  afterAll(async () => {
    await app.close();
    await client.close();
  });

  it('should return current block', async () => {
    const result = await firstValueFrom(
      client.send('current-block', {}).pipe(timeout(5000))
    );
    
    console.log('Received result:', result);
    
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+$/);
  }, 10000);
});
