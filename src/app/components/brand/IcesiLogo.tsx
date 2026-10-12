import positiveLogo from '../../assets/brand/icesi-logo-positive.svg';
import negativeLogo from '../../assets/brand/icesi-logo-negative.svg';
import markLogo from '../../assets/brand/icesi-mark.svg';

interface IcesiLogoProps {
  /** 'mark': solo el simbolo (sin el texto "Universidad Icesi"), para espacios pequenos. */
  variant?: 'positive' | 'negative' | 'mark';
  className?: string;
  ariaLabel?: string;
}

export default function IcesiLogo({
  variant = 'positive',
  className = '',
  ariaLabel = 'Universidad Icesi',
}: IcesiLogoProps) {
  return (
    <img
      src={variant === 'negative' ? negativeLogo : variant === 'mark' ? markLogo : positiveLogo}
      alt={ariaLabel}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
