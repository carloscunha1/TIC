const success = {
  type: 'object',
  required: ['success', 'data', 'requestId'],
  properties: {
    success: { type: 'boolean', const: true },
    data: { type: 'object', additionalProperties: true },
    requestId: { type: 'string' },
  },
};

const errorResponse = {
  type: 'object',
  required: ['success', 'message', 'code', 'details', 'requestId'],
  properties: {
    success: { type: 'boolean', const: false },
    message: { type: 'string' },
    code: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
    requestId: { type: 'string' },
  },
};

function operation(tags: string[], summary: string, options: Record<string, unknown> = {}) {
  return {
    tags,
    summary,
    ...options,
  };
}

function administrativeOperation(summary: string, options: Record<string, unknown> = {}) {
  return operation(['API administrativa'], summary, {
    security: [{ administrativeSession: [] }],
    ...options,
  });
}

const pathParameter = (name: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
});

const generalResponses = {
  '200': { description: 'Operação concluída', content: { 'application/json': { schema: success } } },
  '400': { description: 'Dados inválidos', content: { 'application/json': { schema: errorResponse } } },
  '401': { description: 'Sessão inválida', content: { 'application/json': { schema: errorResponse } } },
  '403': { description: 'Permissão negada', content: { 'application/json': { schema: errorResponse } } },
  '404': { description: 'Recurso não encontrado', content: { 'application/json': { schema: errorResponse } } },
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'TIC API',
    version: '1.0.0',
    description: 'API REST do Sistema de Gestão da Conveniência do Posto Paulo VI.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Saúde' },
    { name: 'API administrativa' },
    { name: 'Fidelidade pública' },
  ],
  components: {
    securitySchemes: {
      administrativeSession: {
        type: 'apiKey',
        in: 'cookie',
        name: 'tic_session',
        description: 'Sessão administrativa armazenada em cookie HttpOnly.',
      },
      customerSession: {
        type: 'apiKey',
        in: 'cookie',
        name: 'tic_customer_session',
        description: 'Sessão pública do cliente armazenada em cookie HttpOnly.',
      },
    },
    schemas: {
      Success: success,
      Error: errorResponse,
    },
  },
  paths: {
    '/health': {
      get: operation(['Saúde'], 'Verificar disponibilidade', {
        responses: { '200': { description: 'Serviço disponível', content: { 'application/json': { schema: success } } } },
      }),
    },

    '/auth/login': {
      post: operation(['API administrativa'], 'Autenticar administrador', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: generalResponses,
      }),
    },
    '/auth/session': {
      get: administrativeOperation('Consultar sessão administrativa', { responses: generalResponses }),
    },
    '/auth/logout': {
      post: administrativeOperation('Encerrar sessão administrativa', {
        responses: { '204': { description: 'Sessão encerrada' } },
      }),
    },
    '/auth/password-reset/complete': {
      post: operation(['API administrativa'], 'Concluir recuperação de senha', {
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: generalResponses,
      }),
    },

    '/users': {
      get: administrativeOperation('Listar usuários', { parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } }], responses: generalResponses }),
      post: administrativeOperation('Criar usuário', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/users/{id}': {
      get: administrativeOperation('Consultar usuário', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Atualizar usuário', { parameters: [pathParameter('id')], requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/users/{id}/status': {
      patch: administrativeOperation('Alterar status do usuário', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/users/{id}/password-reset': {
      post: administrativeOperation('Emitir redefinição de senha', { parameters: [pathParameter('id')], responses: generalResponses }),
    },

    '/categories': {
      get: administrativeOperation('Listar categorias', { responses: generalResponses }),
      post: administrativeOperation('Criar categoria', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/categories/{id}': {
      get: administrativeOperation('Consultar categoria', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Atualizar categoria', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/categories/{id}/status': {
      patch: administrativeOperation('Alterar status da categoria', { parameters: [pathParameter('id')], responses: generalResponses }),
    },

    '/suppliers': {
      get: administrativeOperation('Listar fornecedores', { responses: generalResponses }),
      post: administrativeOperation('Criar fornecedor', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/suppliers/{id}': {
      get: administrativeOperation('Consultar fornecedor', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Atualizar fornecedor', { parameters: [pathParameter('id')], responses: generalResponses }),
    },

    '/products': {
      get: administrativeOperation('Listar produtos', { responses: generalResponses }),
      post: administrativeOperation('Criar produto', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/products/{id}': {
      get: administrativeOperation('Consultar produto', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Atualizar produto', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/products/{id}/status': {
      patch: administrativeOperation('Alterar status do produto', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/products/{id}/value-history': {
      get: administrativeOperation('Consultar histórico de preço/custo', { parameters: [pathParameter('id')], responses: generalResponses }),
    },

    '/entries': {
      get: administrativeOperation('Listar entradas', { responses: generalResponses }),
      post: administrativeOperation('Criar entrada em andamento', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/entries/{id}': {
      get: administrativeOperation('Consultar entrada', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Editar entrada em andamento', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/entries/{id}/confirm': {
      post: administrativeOperation('Confirmar entrada', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/entries/{id}/cancel': {
      post: administrativeOperation('Cancelar entrada confirmada', { parameters: [pathParameter('id')], responses: generalResponses }),
    },

    '/stock/balances': { get: administrativeOperation('Consultar saldos', { responses: generalResponses }) },
    '/stock/adjustments': { post: administrativeOperation('Registrar ajuste de estoque', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }) },
    '/stock/exits': { post: administrativeOperation('Registrar saída de estoque', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }) },
    '/stock/losses': { post: administrativeOperation('Registrar perda', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }) },
    '/stock/loss-reasons': { get: administrativeOperation('Listar motivos de perda', { responses: generalResponses }) },
    '/stock/products/{productId}/lots': { get: administrativeOperation('Listar lotes do produto', { parameters: [pathParameter('productId')], responses: generalResponses }) },

    '/inventories': {
      get: administrativeOperation('Listar inventários', { responses: generalResponses }),
      post: administrativeOperation('Criar inventário', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/inventories/{id}': { get: administrativeOperation('Consultar inventário', { parameters: [pathParameter('id')], responses: generalResponses }) },

    '/customers': {
      get: administrativeOperation('Listar clientes', { responses: generalResponses }),
      post: administrativeOperation('Criar cliente', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/customers/quick': { post: administrativeOperation('Criar cliente rápido', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }) },
    '/customers/{id}': {
      get: administrativeOperation('Consultar cliente', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Atualizar cliente', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/customers/{id}/status': { patch: administrativeOperation('Alterar status do cliente', { parameters: [pathParameter('id')], responses: generalResponses }) },
    '/customers/{id}/pin-setup': { post: administrativeOperation('Emitir link de PIN', { parameters: [pathParameter('id')], responses: generalResponses }) },

    '/customer-auth/login': {
      post: operation(['Fidelidade pública'], 'Autenticar cliente por telefone e PIN', {
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone', 'pin'], properties: { phone: { type: 'string' }, pin: { type: 'string', pattern: '^\\d{6}$' } } } } } },
        responses: generalResponses,
      }),
    },
    '/customer-auth/session': {
      get: operation(['Fidelidade pública'], 'Consultar sessão do cliente', { security: [{ customerSession: [] }], responses: generalResponses }),
    },
    '/customer-auth/loyalty': {
      get: operation(['Fidelidade pública'], 'Consultar próprios pontos e histórico permitido', { security: [{ customerSession: [] }], responses: generalResponses }),
    },
    '/customer-auth/logout': {
      post: operation(['Fidelidade pública'], 'Encerrar sessão do cliente', { responses: generalResponses }),
    },

    '/loyalty/policy': {
      get: administrativeOperation('Consultar política de fidelidade', { responses: generalResponses }),
      patch: administrativeOperation('Atualizar política de fidelidade', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/loyalty/customers/{customerId}/balance': {
      get: administrativeOperation('Consultar saldo de fidelidade', { parameters: [pathParameter('customerId')], responses: generalResponses }),
    },

    '/sales': {
      get: administrativeOperation('Listar vendas', { responses: generalResponses }),
      post: administrativeOperation('Criar venda em andamento', { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: generalResponses }),
    },
    '/sales/{id}': {
      get: administrativeOperation('Consultar venda', { parameters: [pathParameter('id')], responses: generalResponses }),
      patch: administrativeOperation('Editar venda em andamento', { parameters: [pathParameter('id')], responses: generalResponses }),
    },
    '/sales/{id}/confirm': { post: administrativeOperation('Confirmar venda', { parameters: [pathParameter('id')], responses: generalResponses }) },
    '/sales/{id}/cancel': { post: administrativeOperation('Cancelar venda', { parameters: [pathParameter('id')], responses: generalResponses }) },
    '/sales/{id}/returns': { post: administrativeOperation('Registrar devolução parcial', { parameters: [pathParameter('id')], responses: generalResponses }) },

    '/alerts': {
      get: administrativeOperation('Listar alertas', {
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ATIVO', 'RESOLVIDO'] } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['ALTA', 'MEDIA', 'BAIXA'] } },
        ],
        responses: generalResponses,
      }),
    },
    '/alerts/{id}/read': { post: administrativeOperation('Marcar alerta como lido', { parameters: [pathParameter('id')], responses: generalResponses }) },
    '/alerts/read-all': { post: administrativeOperation('Marcar todos os alertas como lidos', { responses: generalResponses }) },

    '/reports/stock/position': { get: administrativeOperation('Relatório de posição de estoque', { responses: generalResponses }) },
    '/reports/stock/movements': { get: administrativeOperation('Relatório de movimentações', { responses: generalResponses }) },
    '/reports/stock/validity': { get: administrativeOperation('Relatório de validade e lotes', { responses: generalResponses }) },
    '/reports/stock/low-rotation': { get: administrativeOperation('Relatório de baixa rotatividade', { responses: generalResponses }) },
    '/reports/entries/suppliers': { get: administrativeOperation('Relatório de entradas e fornecedores', { responses: generalResponses }) },
    '/reports/sales': { get: administrativeOperation('Relatório de vendas', { responses: generalResponses }) },
    '/reports/loyalty': { get: administrativeOperation('Relatório de fidelidade', { responses: generalResponses }) },
    '/reports/dashboard': { get: administrativeOperation('Indicadores do dashboard', { responses: generalResponses }) },

    '/audit': {
      get: administrativeOperation('Consultar logs de auditoria', {
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'actorUserId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entity', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: generalResponses,
      }),
    },
    '/settings': {
      get: administrativeOperation('Consultar configurações da conveniência', { responses: generalResponses }),
      put: administrativeOperation('Atualizar configurações da conveniência', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', maxLength: 160 },
                  cnpj: { type: 'string', maxLength: 18 },
                  phone: { type: 'string', maxLength: 20 },
                  address: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: generalResponses,
      }),
    },
  },
};
