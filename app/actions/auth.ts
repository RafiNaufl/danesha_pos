'use server'
 
import { signIn } from '@/app/lib/auth'
import { AuthError } from 'next-auth'

export async function authenticate(
  prevState: string | undefined | null,
  formData: FormData,
) {
  try {
    const email = formData.get('email')
    const password = formData.get('password')
    
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    
    return undefined 
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.'
        default:
          return 'Something went wrong.'
      }
    }
    throw error
  }
}