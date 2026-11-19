import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterData, type RegisterInput } from '@vetnexa/shared';
import { HeartHandshake, PawPrint, Stethoscope } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { AuthLayout } from './AuthLayout';
import { useRegister } from './useAuth';

const roleOptions = [
  { value: 'OWNER', icon: PawPrint, title: 'Pet owner', text: 'Manage my pets’ health' },
  { value: 'VET', icon: Stethoscope, title: 'Veterinarian', text: 'Care for patients' },
  { value: 'RESCUER', icon: HeartHandshake, title: 'Rescuer', text: 'Rescue and rehome' },
] as const;

type SelfRole = (typeof roleOptions)[number]['value'];

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const initialRole: SelfRole = roleOptions.some((option) => option.value === requestedRole)
    ? (requestedRole as SelfRole)
    : 'OWNER';

  const signUp = useRegister();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole },
  });
  const role = useWatch({ control, name: 'role' });

  const onSubmit = (data: RegisterData) =>
    signUp.mutate(data, {
      onSuccess: () => navigate('/dashboard', { replace: true, state: { welcome: true } }),
      onError: (error) => applyServerErrors(error, setError),
    });

  const showGeneralError = signUp.isError && !hasFieldErrors(signUp.error);

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already registered? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {showGeneralError && <Alert tone="error">{signUp.error.message}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="role-picker">
          <legend>I am joining as a…</legend>
          <div className="role-picker__options">
            {roleOptions.map(({ value, icon: Icon, title, text }) => (
              <label key={value} className="role-option">
                <input type="radio" value={value} {...register('role')} />
                <Icon size={20} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <TextField
            label="First name"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          optional
          placeholder="07X XXX XXXX"
          error={errors.phone?.message}
          {...register('phone')}
        />

        {role === 'VET' && (
          <>
            <Alert tone="info">
              We verify every veterinary licence before you can view patient records. This usually
              takes one working day.
            </Alert>
            <div className="field-row">
              <TextField
                label="Licence number"
                placeholder="SLVC-2024-0001"
                error={errors.licenseNumber?.message}
                {...register('licenseNumber')}
              />
              <TextField
                label="Specialisation"
                optional
                placeholder="e.g. Small animal surgery"
                error={errors.specialization?.message}
                {...register('specialization')}
              />
            </div>
          </>
        )}

        <div className="field-row">
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters with upper and lower case letters and a number"
            error={errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <Button type="submit" block loading={signUp.isPending} loadingText="Creating account…">
          Create account
        </Button>
        <p className="terms-note">
          By creating an account you agree to use VetNexa responsibly. AI features give preliminary
          guidance only and do not replace professional veterinary advice.
        </p>
      </form>
    </AuthLayout>
  );
}
