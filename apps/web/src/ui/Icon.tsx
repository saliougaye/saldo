import { type IconName, iconDefaults, iconNodeKey, iconNodes } from '@saldo/ui';

interface Props {
  name: IconName;
  /** In pixels, as the design gives them; `currentColor` decides the colour. */
  size?: number;
  className?: string;
}

/** One icon of the design set (`@saldo/ui`), as DOM SVG. `aria-hidden`: the label is in the text. */
export function Icon({ name, size = iconDefaults.size, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={iconDefaults.viewBox}
      fill={iconDefaults.fill}
      stroke="currentColor"
      strokeWidth={iconDefaults.strokeWidth}
      strokeLinecap={iconDefaults.strokeLinecap}
      strokeLinejoin={iconDefaults.strokeLinejoin}
      aria-hidden="true"
      focusable="false"
    >
      {iconNodes[name].map((node) => {
        const key = iconNodeKey(node);
        if (node.tag === 'circle') return <circle key={key} {...node.attrs} />;
        if (node.tag === 'rect') return <rect key={key} {...node.attrs} />;
        return <path key={key} {...node.attrs} />;
      })}
    </svg>
  );
}
