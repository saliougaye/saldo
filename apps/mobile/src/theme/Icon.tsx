import { type IconName, type IconNode, iconDefaults, iconNodes } from '@saldo/ui';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { useTheme } from './ThemeProvider';

const ELEMENTS = { path: Path, circle: Circle, rect: Rect } as const;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Defaults to the current text colour. */
  color?: string;
  strokeWidth?: number;
}

/** Identifies a node by the geometry attribute that distinguishes it within an icon. */
function nodeKey(node: IconNode): string {
  return (
    node.attrs.d ?? `${node.attrs.cx ?? node.attrs.x ?? ''},${node.attrs.cy ?? node.attrs.y ?? ''}`
  );
}

function IconElement({ node, color }: { node: IconNode; color: string }) {
  const Element = ELEMENTS[node.tag];
  // The design encodes solid parts as fill="currentColor"; everything else is a stroked outline.
  const fill = node.attrs.fill === 'currentColor' ? color : (node.attrs.fill ?? 'none');
  return <Element {...node.attrs} fill={fill} stroke={node.attrs.stroke ?? color} />;
}

export function Icon({ name, size = iconDefaults.size, color, strokeWidth }: IconProps) {
  const theme = useTheme();
  const resolved = color ?? theme.palette.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={iconDefaults.viewBox}
      fill="none"
      stroke={resolved}
      strokeWidth={strokeWidth ?? iconDefaults.strokeWidth}
      strokeLinecap={iconDefaults.strokeLinecap}
      strokeLinejoin={iconDefaults.strokeLinejoin}
    >
      {iconNodes[name].map((node) => (
        // The node list is static data, so its own shape is a stable identity; no index needed.
        <IconElement key={`${node.tag}:${nodeKey(node)}`} node={node} color={resolved} />
      ))}
    </Svg>
  );
}
