import { GlobeLoading } from './GlobeLoading';

interface LoadingStateProps {
  label?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

export function LoadingState({
  label = 'Loading...',
  size = 'medium',
  fullScreen = false,
}: LoadingStateProps) {
  return (
    <GlobeLoading
      label={label}
      size={size}
      fullScreen={fullScreen}
    />
  );
}
