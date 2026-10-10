import { createBrowserRouter, type RouteObject } from 'react-router';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/guards';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { NotFoundPage } from './NotFoundPage';

// Pages chargées à la demande : chaque route a son propre fichier JS.

export const routes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            lazy: () =>
              import('@/features/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: '/register',
            lazy: () =>
              import('@/features/auth/RegisterPage').then((m) => ({ Component: m.RegisterPage })),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            lazy: () =>
              import('@/features/dashboard/DashboardPage').then((m) => ({
                Component: m.DashboardPage,
              })),
          },
          {
            path: '/tasks',
            lazy: () =>
              import('@/features/tasks/TasksPage').then((m) => ({ Component: m.TasksPage })),
          },
          {
            path: '/projects',
            lazy: () =>
              import('@/features/projects/ProjectsPage').then((m) => ({
                Component: m.ProjectsPage,
              })),
          },
          {
            path: '/projects/:projectId',
            lazy: () =>
              import('@/features/projects/ProjectPage').then((m) => ({ Component: m.ProjectPage })),
          },
          {
            path: '/projects/:projectId/settings',
            lazy: () =>
              import('@/features/projects/ProjectSettingsPage').then((m) => ({
                Component: m.ProjectSettingsPage,
              })),
          },
          {
            path: '/profile',
            lazy: () =>
              import('@/features/profile/ProfilePage').then((m) => ({ Component: m.ProfilePage })),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
