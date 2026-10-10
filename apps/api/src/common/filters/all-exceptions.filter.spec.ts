import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('erreur', { code, clientVersion: 'test', meta });

describe('AllExceptionsFilter', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('uniformise tous les 404', () => {
    expect(run(new NotFoundException('Tâche 42 appartenant à Bob'))).toEqual({
      status: 404,
      body: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Ressource introuvable',
        requestId: 'req-1',
      },
    });
  });

  it('conserve le message des autres HttpException', () => {
    expect(run(new ConflictException('Déjà membre')).body.message).toBe('Déjà membre');
    const fields = [{ field: 'title', constraints: ['trop long'] }];
    expect(run(new BadRequestException({ message: fields })).body.message).toEqual(fields);
  });

  it('traduit les erreurs Prisma', () => {
    expect(run(prismaError('P2025')).status).toBe(404);
    expect(run(prismaError('P2002')).status).toBe(409);
    for (const meta of [
      { constraint: 'tasks_assignee_fkey' },
      { field_name: 'tasks_assignee_fkey (index)' },
    ]) {
      expect(run(prismaError('P2003', meta))).toMatchObject({
        status: 422,
        body: { message: 'La personne assignée doit être membre du projet' },
      });
    }
    expect(run(prismaError('P2003', { field_name: 'autre_fkey' })).status).toBe(500);
  });

  it('masque le détail des erreurs inconnues', () => {
    const { status, body } = run(new Error('mot de passe de la base : hunter2'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
