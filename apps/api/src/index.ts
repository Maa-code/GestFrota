import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { authRoutes, sessionMiddleware } from './modules/auth/index.js';
import { organizacaoRoutes } from './modules/organizacao/index.js';
import { frotaRoutes } from './modules/frota/index.js';
import { fornecimentoRoutes } from './modules/fornecimento/index.js';
import { cotasRoutes } from './modules/cotas/index.js';
import { auditoriaRoutes } from './modules/auditoria/index.js';

export function buildApp() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // Plugins Base
  fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'gestfrota-super-secret-cookie-key-2026',
    hook: 'onRequest',
  });

  // OpenAPI 3.1 Documentation
  fastify.register(swagger, {
    openapi: {
      info: {
        title: 'GestFrota API',
        description: 'API central do Sistema de Gestão de Combustível e Frota Municipal',
        version: '1.0.0',
      },
    },
  });

  fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Middleware de Sessão e Tenant Context
  fastify.addHook('onRequest', sessionMiddleware);

  // Healthcheck
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      service: 'GestFrota API', 
      versao: '1.0.0',
      timestamp: new Date().toISOString() 
    };
  });

  // Registro de Módulos de Domínio
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(organizacaoRoutes, { prefix: '/api/organizacao' });
  fastify.register(frotaRoutes, { prefix: '/api/frota' });
  fastify.register(fornecimentoRoutes, { prefix: '/api/fornecimento' });
  fastify.register(cotasRoutes, { prefix: '/api/cotas' });
  fastify.register(auditoriaRoutes, { prefix: '/api/auditoria' });

  return fastify;
}

const start = async () => {
  const app = buildApp();
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`GestFrota API listening on http://localhost:${port}`);
    console.log(`OpenAPI Documentation at http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

import { fileURLToPath } from 'node:url';

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts')
);

if (isMainModule && process.env.NODE_ENV !== 'test') {
  start();
}
