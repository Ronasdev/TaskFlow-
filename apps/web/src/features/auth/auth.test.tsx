import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API, server, testSession } from '@/test/server';
import { renderRoutes } from '@/test/render';
import { ProtectedRoute, PublicOnlyRoute } from './guards';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

const routes = [
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/secret', element: <p>Zone protégée</p> }],
  },
];

describe('routes protégées', () => {
  it('redirige un visiteur anonyme vers /login', async () => {
    const { router } = renderRoutes(routes, '/secret');
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText('Zone protégée')).not.toBeInTheDocument();
  });

  it('affiche un chargement pendant la restauration de session', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        await delay(100);
        return HttpResponse.json({}, { status: 401 });
      }),
    );
    renderRoutes(routes, '/secret');
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeInTheDocument();
    // Laisse le refresh se terminer : la promesse partagée ne doit pas fuir vers le test suivant.
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  it('restaure la session via le cookie de refresh', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(testSession)));
    renderRoutes(routes, '/secret');
    expect(await screen.findByText('Zone protégée')).toBeInTheDocument();
  });

  it("renvoie un utilisateur connecté vers la page d'origine après connexion", async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(testSession)));
    const { router } = renderRoutes(routes, '/secret');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'alice@test.dev');
    await user.type(screen.getByLabelText('Mot de passe'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Zone protégée')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/secret');
  });
});

describe('LoginPage', () => {
  it('valide les champs avant envoi', async () => {
    renderRoutes(routes, '/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText("L'email est requis")).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est requis')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('affiche l’erreur d’identifiants renvoyée par l’API', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ statusCode: 401, message: 'Identifiants invalides' }, { status: 401 }),
      ),
    );
    renderRoutes(routes, '/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'alice@test.dev');
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides');
  });
});

describe('RegisterPage', () => {
  it('vérifie la robustesse et la confirmation du mot de passe', async () => {
    renderRoutes(routes, '/register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nom'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@test.dev');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'autre');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Au moins un chiffre')).toBeInTheDocument();
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
  });

  it('affiche le conflit d’email sur le champ concerné', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json({ message: 'Un compte existe déjà avec cet email' }, { status: 409 }),
      ),
    );
    renderRoutes(routes, '/register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nom'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@test.dev');
    await user.type(screen.getByLabelText('Mot de passe'), 'Password123');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() =>
      expect(screen.getByText('Un compte existe déjà avec cet email')).toBeInTheDocument(),
    );
  });
});
