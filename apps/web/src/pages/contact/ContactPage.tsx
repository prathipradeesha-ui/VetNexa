import { zodResolver } from '@hookform/resolvers/zod';
import {
  CONTACT_TOPIC_LABELS,
  CONTACT_TOPICS,
  contactSchema,
  type ContactData,
  type ContactInput,
} from '@vetnexa/shared';
import { useMutation } from '@tanstack/react-query';
import { Clock, Phone, Siren, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { site } from '../../config/site';
import { api } from '../../lib/api';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import '../pages.css';

interface ContactResponse {
  message: string;
  reference: string;
}

export function ContactPage() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', message: '' },
  });

  const send = useMutation({
    mutationFn: (data: ContactData) =>
      api<ContactResponse>('/contact', { method: 'POST', body: data }),
    onSuccess: () => reset(),
    onError: (error) => applyServerErrors(error, setError),
  });

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Contact us</span>
          <h1>We are here to help</h1>
          <p className="lead">
            Questions about your account, joining as a veterinarian or listing a clinic? Send us a
            message and we will reply by email.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <div className="card">
            <h2>Send a message</h2>

            {send.isSuccess && (
              <Alert tone="success" title="Message sent">
                {send.data.message} Your reference is <strong>{send.data.reference}</strong>.
              </Alert>
            )}
            {send.isError && !hasFieldErrors(send.error) && (
              <Alert tone="error">{send.error.message}</Alert>
            )}

            <form onSubmit={handleSubmit((data) => send.mutate(data))} noValidate>
              <div className="field-row">
                <TextField
                  label="Your name"
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <TextField
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>
              <div className="field-row">
                <TextField
                  label="Mobile number"
                  type="tel"
                  autoComplete="tel"
                  optional
                  placeholder="07X XXX XXXX"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <FieldWrapper id="contact-topic" label="Topic" error={errors.topic?.message}>
                  <select
                    id="contact-topic"
                    className="select"
                    aria-invalid={errors.topic ? true : undefined}
                    {...register('topic')}
                  >
                    <option value="">Choose a topic</option>
                    {CONTACT_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {CONTACT_TOPIC_LABELS[topic]}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              </div>
              <FieldWrapper id="contact-message" label="Message" error={errors.message?.message}>
                <textarea
                  id="contact-message"
                  className="textarea"
                  rows={6}
                  aria-invalid={errors.message ? true : undefined}
                  {...register('message')}
                />
              </FieldWrapper>
              <Button type="submit" loading={send.isPending} loadingText="Sending…">
                Send message
              </Button>
            </form>
          </div>

          <aside className="contact-aside">
            <div className="card">
              <h2>Contact details</h2>
              <ul className="contact-list">
                <li>
                  <UserRound size={20} aria-hidden="true" />
                  <div>
                    <strong>{site.owner.name}</strong>
                    <span>{site.owner.role}</span>
                  </div>
                </li>
                <li>
                  <Phone size={20} aria-hidden="true" />
                  <div>
                    <strong>
                      <a href={`tel:${site.owner.phoneInternational}`}>{site.owner.phone}</a>
                    </strong>
                    <span>Phone</span>
                  </div>
                </li>
                <li>
                  <Clock size={20} aria-hidden="true" />
                  <div>
                    <strong>{site.supportHours}</strong>
                    <span>Support hours (Sri Lanka time)</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="emergency-note" role="note">
              <Siren size={22} aria-hidden="true" />
              <div>
                <strong>Is it an emergency?</strong>
                <p>{site.emergencyNote}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
