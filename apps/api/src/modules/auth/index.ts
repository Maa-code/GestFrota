import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  LoginRequestSchema, 
  TrocarPerfilRequestSchema, 
  UsuarioSessao, 
  PerfilAtivo,
  PapelUsuario 
} from '@gestfrota/contratos';
import { queryTenant } from '../../db/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    session?: UsuarioSessao;
    enteId?: string;
  }
}

const SESSION_COOKIE_NAME = 'gestfrota_session';

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ erro: 'Dados de login inválidos', detalhes: parseResult.error.errors });
    }

    const { email } = parseResult.data;

    // Busca usuário e seus papéis com entes vinculados
    const userRes = await queryTenant(null, `
      SELECT u.id, u.nome, u.email, u.cpf, u.ativo, u.ente_id
      FROM usuarios u
      WHERE u.email = $1 AND u.ativo = true
      LIMIT 1
    `, [email]);

    if (userRes.rows.length === 0) {
      return reply.status(401).send({ erro: 'Credenciais inválidas ou usuário inativo' });
    }

    const user = userRes.rows[0];

    // Busca todas as atribuições de papéis desse usuário
    const papeisRes = await queryTenant(null, `
      SELECT ap.papel, ap.ente_id, e.nome as ente_nome, ap.secretaria_id
      FROM atribuicoes_papel ap
      JOIN entes e ON e.id = ap.ente_id
      WHERE ap.usuario_id = $1 AND e.ativo = true
    `, [user.id]);

    if (papeisRes.rows.length === 0) {
      return reply.status(403).send({ erro: 'Usuário não possui perfis ativos vinculados a nenhum ente' });
    }

    const perfis: PerfilAtivo[] = papeisRes.rows.map(r => ({
      papel: r.papel as PapelUsuario,
      enteId: r.ente_id,
      enteNome: r.ente_nome,
      secretariaId: r.secretaria_id || null,
    }));

    // Perfil inicial padrão (o primeiro atribuído)
    const perfilAtivo = perfis[0];

    const sessao: UsuarioSessao = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      perfis,
      perfilAtivo,
    };

    // Serializa sessão em cookie HttpOnly seguro (sem tokens no localStorage)
    const sessionToken = Buffer.from(JSON.stringify(sessao)).toString('base64');
    reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return reply.send({
      mensagem: 'Login realizado com sucesso',
      usuario: sessao,
    });
  });

  // 2. Trocar Perfil / Ente ativo sem novo login
  fastify.post('/trocar-perfil', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session) {
      return reply.status(401).send({ erro: 'Não autenticado' });
    }

    const parseResult = TrocarPerfilRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parseResult.error.errors });
    }

    const { enteId, papel } = parseResult.data;

    // Confere se o usuário realmente tem esse papel no ente solicitado
    const perfilEncontrado = request.session.perfis.find(
      p => p.enteId === enteId && p.papel === papel
    );

    if (!perfilEncontrado) {
      return reply.status(403).send({ erro: 'Perfil não autorizado para este usuário neste ente' });
    }

    request.session.perfilAtivo = perfilEncontrado;

    const sessionToken = Buffer.from(JSON.stringify(request.session)).toString('base64');
    reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.send({
      mensagem: 'Perfil alterado com sucesso',
      perfilAtivo: perfilEncontrado,
    });
  });

  // 3. Obter sessão atual
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session) {
      return reply.status(401).send({ erro: 'Não autenticado' });
    }
    return reply.send(request.session);
  });

  // 4. Logout
  fastify.post('/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.send({ mensagem: 'Sessão encerrada com sucesso' });
  });
}

/**
 * Hook para restaurar sessão a partir do Cookie HttpOnly e injetar tenant context
 */
export async function sessionMiddleware(request: FastifyRequest) {
  const cookieVal = request.cookies[SESSION_COOKIE_NAME];
  if (!cookieVal) return;

  try {
    const raw = Buffer.from(cookieVal, 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as UsuarioSessao;
    request.session = parsed;
    request.enteId = parsed.perfilAtivo?.enteId;
  } catch {
    // Cookie inválido ou corrompido, ignora
  }
}

/**
 * Guarda de rota: exige autenticação prévia
 */
export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session) {
      return reply.status(401).send({ erro: 'Autenticação obrigatória' });
    }
  };
}

/**
 * Guarda de rota: exige papéis específicos
 */
export function requireRoles(papeisPermitidos: PapelUsuario[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session) {
      return reply.status(401).send({ erro: 'Autenticação obrigatória' });
    }
    const papelAtual = request.session.perfilAtivo.papel;
    if (!papeisPermitidos.includes(papelAtual)) {
      return reply.status(403).send({
        erro: 'Acesso negado para o papel atual',
        papelAtual,
        papeisPermitidos,
      });
    }
  };
}
