import FormPage from '@/pages/form';
import NotFound from '@/pages/not-found';
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, useRoutes } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ProtectedRouteForFeatures from '@/components/auth/ProtectedRouteForFeatures';
import React from 'react';
import logoImage from '@/assets/images/lg34.png';


// Lazy import for LandingPage
const LandingPage = lazy(() => import('@/pages/Landingpage'));
const DashboardLayout = lazy(() => import('@/components/layout/dashboard-layout'));
const SignInPage = lazy(() => import('@/pages/auth/signin'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));

const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'));
const SignUpPage = lazy(() => import('@/pages/auth/signup'));
const TermsAndConditions = lazy(() => import('@/pages/terms/TermsAndConditions'));
const PolicyPage = lazy(() => import('@/pages/policy/policy'));

const TestPage = lazy(() => import('@/pages/Test'));

const ManageSubscriptionPage = lazy(() => import('@/pages/ManageSubscription'));


const REQUIRES_BASIC = ['basic'] as const;
const REQUIRES_PRO = ['pro'] as const;
const REQUIRES_NONE = [] as const;

export default function AppRouter() {

  function CenteredLogoLoader() {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-transparent">
        <img src={logoImage} alt="Loading..." className="h-20 w-auto" />
      </div>
    );
  }

  const routes = useRoutes([
    // Landing page route (public, root "/")
    {
      path: '/',
      element: (
        <Suspense fallback={<CenteredLogoLoader />}>
          <LandingPage />
        </Suspense>
      )
    },

    // Public routes
    {
      path: 'auth',
      children: [
        {
          path: 'signin',
          element: (
            <Suspense fallback={<CenteredLogoLoader />}>
              <SignInPage />
            </Suspense>
          )
        },
        {
          path: 'signup',
          element: (
            <Suspense fallback={<CenteredLogoLoader />}>
              <SignUpPage />
            </Suspense>
          )
        },
        {
          path: 'forgot-password',
          element: (
            <Suspense fallback={<CenteredLogoLoader />}>
              <ForgotPasswordPage />
            </Suspense>
          )
        }
      ]
    },
    {
      path: 'terms',
      element: (
        <Suspense fallback={<CenteredLogoLoader />}>
          <TermsAndConditions />
        </Suspense>
      )
    },
      {
    path: 'policy',
    element: (
      <Suspense fallback={<CenteredLogoLoader />}>
        <PolicyPage />
      </Suspense>
    )
  },


    // Protected dashboard routes (move to '/dashboard' or similar)
    {
      path: 'dashboard',
      element: (
        <ProtectedRoute>
          <Suspense fallback={<CenteredLogoLoader />}>
            <DashboardLayout>
              <Outlet />
            </DashboardLayout>
          </Suspense>
        </ProtectedRoute>
      ),
      children: [
        {
          element: (
            <ProtectedRouteForFeatures requiresSubscription={REQUIRES_NONE}>
              <DashboardPage />
            </ProtectedRouteForFeatures>
          ),
          index: true
        },
 
        {
          path: 'ManageSubscription',
            element: (
              <ProtectedRouteForFeatures requiresSubscription={REQUIRES_NONE}>
                <ManageSubscriptionPage />
              </ProtectedRouteForFeatures>
            )
        },
        {
          path: 'form',
          element: (
            <ProtectedRouteForFeatures requiresSubscription={REQUIRES_BASIC}>
              <FormPage />
            </ProtectedRouteForFeatures>
          )
        }
      ]
    },

    // Fallback routes
    {
      path: '404',
      element: <NotFound />
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />
    }
  ]);

  return routes;
}