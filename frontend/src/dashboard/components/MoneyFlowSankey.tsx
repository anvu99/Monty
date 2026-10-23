import { useEffect, useRef } from 'react';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';
import { scaleOrdinal } from 'd3-scale';

interface SankeyData {
  nodes: Array<{ name: string; category?: string }>;
  links: Array<{ source: number; target: number; value: number }>;
}

interface Props {
  data?: SankeyData;
  childName?: string;
}

const DEFAULT_DATA: SankeyData = {
  nodes: [
    { name: 'Family Income', category: 'income' },
    { name: 'Fixed Costs', category: 'needs' },
    { name: 'Savings', category: 'savings' },
    { name: 'Discretionary', category: 'wants' },
    { name: 'Housing', category: 'needs' },
    { name: 'Utilities', category: 'needs' },
    { name: 'Groceries', category: 'needs' },
    { name: 'Emergency Fund', category: 'savings' },
    { name: 'Kids Goals', category: 'savings' },
    { name: 'Entertainment', category: 'wants' },
    { name: 'Dining Out', category: 'wants' },
    { name: 'Shopping', category: 'wants' },
  ],
  links: [
    // Income splits
    { source: 0, target: 1, value: 1800 }, // Income → Fixed Costs
    { source: 0, target: 2, value: 900 },  // Income → Savings
    { source: 0, target: 3, value: 800 },  // Income → Discretionary

    // Fixed Costs breakdown
    { source: 1, target: 4, value: 1000 }, // Fixed → Housing
    { source: 1, target: 5, value: 400 },  // Fixed → Utilities
    { source: 1, target: 6, value: 400 },  // Fixed → Groceries

    // Savings breakdown
    { source: 2, target: 7, value: 600 },  // Savings → Emergency
    { source: 2, target: 8, value: 300 },  // Savings → Kids Goals

    // Discretionary breakdown
    { source: 3, target: 9, value: 300 },  // Discretionary → Entertainment
    { source: 3, target: 10, value: 300 }, // Discretionary → Dining
    { source: 3, target: 11, value: 200 }, // Discretionary → Shopping
  ],
};

const COLORS = {
  income: '#11A39A',
  needs: '#E07A5F',
  savings: '#7E6AE6',
  wants: '#F59E0B',
  category: '#7E6AE6',
  default: '#94a3b8',
};

const CATEGORY_COLORS = ['#11A39A', '#E07A5F', '#7E6AE6', '#F59E0B', '#D1654B', '#0E6F6B', '#C4B8FF', '#10B981'];

export default function MoneyFlowSankey({ data = DEFAULT_DATA, childName }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 500;
    const margin = { top: 10, right: 120, bottom: 10, left: 120 };

    // Clear previous render
    const svg = svgRef.current;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Create sankey generator
    const sankeyGenerator = sankey<SankeyNode<{ name: string; category?: string }, {}>, SankeyLink<SankeyNode<{ name: string; category?: string }, {}>, {}>>()
      .nodeWidth(15)
      .nodePadding(20)
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ]);

    // Generate the sankey diagram
    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d })),
    });

    // Color scale
    const colorScale = scaleOrdinal<string>()
      .domain(['income', 'needs', 'savings', 'wants'])
      .range([COLORS.income, COLORS.needs, COLORS.savings, COLORS.wants]);

    // Create gradient definitions for links
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    links.forEach((link, i) => {
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', `gradient-${i}`);
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

      const sourceNode = link.source as SankeyNode<{ name: string; category?: string }, {}>;
      const targetNode = link.target as SankeyNode<{ name: string; category?: string }, {}>;

      gradient.setAttribute('x1', String(sourceNode.x1 ?? 0));
      gradient.setAttribute('x2', String(targetNode.x0 ?? 0));

      const sourceColor = sourceNode.category ? colorScale(sourceNode.category) : COLORS.default;
      const targetColor = targetNode.category ? colorScale(targetNode.category) : COLORS.default;

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', sourceColor);
      stop1.setAttribute('stop-opacity', '0.5');

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', targetColor);
      stop2.setAttribute('stop-opacity', '0.5');

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
    });
    svg.appendChild(defs);

    // Draw links
    const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    links.forEach((link, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const linkPath = sankeyLinkHorizontal();
      path.setAttribute('d', linkPath(link) || '');
      path.setAttribute('stroke', `url(#gradient-${i})`);
      path.setAttribute('stroke-width', String(Math.max(1, link.width ?? 0)));
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.6');
      path.style.transition = 'opacity 0.2s';

      // Add hover effect
      path.addEventListener('mouseenter', () => {
        path.setAttribute('opacity', '1');
      });
      path.addEventListener('mouseleave', () => {
        path.setAttribute('opacity', '0.6');
      });

      // Tooltip on hover
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const sourceNode = link.source as SankeyNode<{ name: string; category?: string }, {}>;
      const targetNode = link.target as SankeyNode<{ name: string; category?: string }, {}>;
      title.textContent = `${sourceNode.name} → ${targetNode.name}: $${link.value}`;
      path.appendChild(title);

      linksGroup.appendChild(path);
    });
    svg.appendChild(linksGroup);

    // Draw nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodes.forEach((node, idx) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(node.x0 ?? 0));
      rect.setAttribute('y', String(node.y0 ?? 0));
      rect.setAttribute('width', String((node.x1 ?? 0) - (node.x0 ?? 0)));
      rect.setAttribute('height', String((node.y1 ?? 0) - (node.y0 ?? 0)));

      // Use category color if available, otherwise use color from palette
      let fillColor = COLORS.default;
      if (node.category === 'income') {
        fillColor = COLORS.income;
      } else if (node.category === 'category') {
        fillColor = CATEGORY_COLORS[(idx - 1) % CATEGORY_COLORS.length];
      } else if (node.category) {
        fillColor = colorScale(node.category);
      }

      rect.setAttribute('fill', fillColor);
      rect.setAttribute('rx', '4');

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${node.name}: $${node.value}`;
      rect.appendChild(title);

      nodesGroup.appendChild(rect);

      // Add labels
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const textX = (node.x0 ?? 0) < width / 2
        ? (node.x1 ?? 0) + 6
        : (node.x0 ?? 0) - 6;
      const textY = ((node.y1 ?? 0) + (node.y0 ?? 0)) / 2;

      text.setAttribute('x', String(textX));
      text.setAttribute('y', String(textY));
      text.setAttribute('dy', '0.35em');
      text.setAttribute('text-anchor', (node.x0 ?? 0) < width / 2 ? 'start' : 'end');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', '500');
      text.setAttribute('fill', '#1e293b');
      text.textContent = node.name;

      // Add value label
      const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valueText.setAttribute('x', String(textX));
      valueText.setAttribute('y', String(textY + 14));
      valueText.setAttribute('dy', '0.35em');
      valueText.setAttribute('text-anchor', (node.x0 ?? 0) < width / 2 ? 'start' : 'end');
      valueText.setAttribute('font-size', '10');
      valueText.setAttribute('font-family', 'JetBrains Mono, monospace');
      valueText.setAttribute('fill', '#64748b');
      valueText.textContent = `$${node.value}`;

      nodesGroup.appendChild(text);
      nodesGroup.appendChild(valueText);
    });
    svg.appendChild(nodesGroup);
  }, [data]);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">
          Spending Breakdown
        </p>
        <p className="text-xs text-slate-400">
          {childName ? `${childName}'s spending by category` : 'Where money is going by category'}
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          className="w-full"
          style={{ minHeight: '500px' }}
        />
      </div>

      <div className="mt-4 text-center text-xs text-slate-400">
        Hover over connections to see spending amounts
      </div>
    </div>
  );
}
