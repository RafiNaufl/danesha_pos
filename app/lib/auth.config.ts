import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const userRole = auth?.user?.role;
      
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      
      // Allow access to login page
      if (isOnLogin) {
        if (isLoggedIn) {
           return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }

      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect unauthenticated to login
        
        const isOnPos = nextUrl.pathname.startsWith('/dashboard/pos');
        
        // If user is KASIR and tries to access non-POS dashboard pages
        if (userRole !== 'ADMIN' && !isOnPos) {
           return Response.redirect(new URL('/dashboard/pos', nextUrl));
        }
        
        return true;
      }

      return true;
    },
    async session({ session, token }) {
      try {
        if (session.user && token) {
          if (token.sub) {
            session.user.id = token.sub;
          }
          if (token.role) {
            session.user.role = token.role as "ADMIN" | "KASIR";
          }
        }
      } catch (error) {
        console.error("Error in session callback:", error);
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    }
  },
  providers: [], // Providers added in auth.ts
  session: {
    strategy: 'jwt',
  },
} satisfies NextAuthConfig;
