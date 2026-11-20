import { Camera } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

interface PhotoPickerProps {
  label: string;
  hasPhoto: boolean;
  uploading: boolean;
  onUpload: (file: File, onError: (message: string) => void) => void;
}

/**
 * "Add photo" button with quick checks in the browser (type and size) before uploading.
 * The server validates and re-encodes the image again, so these checks are only for speed.
 */
export function PhotoPicker({ label, hasPhoto, uploading, onUpload }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError('Please choose a JPG, PNG or WebP image.');
    if (file.size > MAX_MB * 1024 * 1024)
      return setError(`Photos must be ${MAX_MB} MB or smaller.`);
    setError(null);
    onUpload(file, setError);
  };

  return (
    <div className="photo-picker">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        className="sr-only"
        aria-label={label}
        onChange={onChange}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => input.current?.click()}
        loading={uploading}
        loadingText="Uploading…"
      >
        <Camera size={16} aria-hidden="true" /> {hasPhoto ? 'Change photo' : 'Add photo'}
      </Button>
      <span className="field__hint">JPG, PNG or WebP, up to {MAX_MB} MB</span>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
