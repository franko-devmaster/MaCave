import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cave' },
  {
    path: 'cave',
    title: 'Ma Cave',
    loadComponent: () => import('./pages/cave/cave-page').then((m) => m.CavePage),
  },
  {
    path: 'cave/:id',
    title: 'Fiche · Ma Cave',
    data: { hideTabBar: true },
    loadComponent: () => import('./pages/fiche/fiche-page').then((m) => m.FichePage),
  },
  {
    path: 'cave/:id/modifier',
    title: 'Modifier · Ma Cave',
    data: { hideTabBar: true },
    loadComponent: () => import('./pages/modifier/modifier-page').then((m) => m.ModifierPage),
  },
  {
    path: 'cave/:id/noter',
    title: 'Noter · Ma Cave',
    data: { hideTabBar: true },
    loadComponent: () => import('./pages/noter/noter-page').then((m) => m.NoterPage),
  },
  {
    path: 'ajouter',
    title: 'Ajouter · Ma Cave',
    data: { hideTabBar: true },
    loadComponent: () => import('./pages/ajouter/ajouter-page').then((m) => m.AjouterPage),
  },
  {
    path: 'accords',
    title: 'Accords · Ma Cave',
    loadComponent: () => import('./pages/accords/accords-page').then((m) => m.AccordsPage),
  },
  {
    path: 'gouts',
    title: 'Mes goûts · Ma Cave',
    loadComponent: () => import('./pages/gouts/gouts-page').then((m) => m.GoutsPage),
  },
  {
    path: 'reglages',
    title: 'Réglages · Ma Cave',
    data: { hideTabBar: true },
    loadComponent: () => import('./pages/reglages/reglages-page').then((m) => m.ReglagesPage),
  },
  { path: '**', redirectTo: 'cave' },
];
