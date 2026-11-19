import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@vetnexa/shared';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { AuthLayout } from './AuthLayout';
import { useLogin } from './useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // If the user was sent here from a protected page, return them there after signing in.
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginInput) =>
    login.mutate(data, { onSuccess: () => navigate(from, { replace: true }) });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New to VetNexa? <Link to="/register">Create a free account</Link>
        </>
      }
    >
      {login.isError && <Alert tone="error">{login.error.message}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" block loading={login.isPending} loadingText="Signing in…">
          Sign in
        </Button>
      </form>

      <p className="auth__footer">
        Forgot your password? <Link to="/contact">Contact support</Link> and we will help you regain
        access.
      </p>
    </AuthLayout>
  );
}
