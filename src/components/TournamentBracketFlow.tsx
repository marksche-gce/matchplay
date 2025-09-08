import React, { useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface Player {
  id: string;
  name: string;
  handicap: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: string;
  round: string;
  status: string;
  player1?: { name: string; handicap?: number } | null;
  player2?: { name: string; handicap?: number } | null;
  winner?: string;
  date?: string;
  time?: string;
  tee?: number | string;
  nextMatchId?: string;
  previousMatch1Id?: string;
  previousMatch2Id?: string;
}

interface TournamentBracketFlowProps {
  tournamentId: string;
  matches: Match[];
  players: Player[];
  onMatchSelect?: (matchId: string) => void;
}

// Custom match node component
const MatchNode = ({ data }: { data: any }) => {
  const { match, onSelect } = data;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 border-success/30';
      case 'in-progress': return 'bg-warning/10 border-warning/30';
      case 'scheduled': return 'bg-primary/10 border-primary/30';
      default: return 'bg-secondary/10 border-secondary/30';
    }
  };

  const player1Name = match.player1?.name || 'Unbekannt';
  const player2Name = match.player2?.name || 'Unbekannt';
  const isPlaceholder = player1Name.includes('no-opponent') || player2Name.includes('no-opponent');

  return (
    <Card 
      className={`w-48 cursor-pointer ${getStatusColor(match.status)} hover:shadow-md transition-shadow`}
      onClick={() => onSelect?.(match.id)}
    >
      <CardHeader className="p-2">
        <CardTitle className="text-xs text-center">{match.round}</CardTitle>
        <Badge variant="outline" className="text-xs mx-auto">
          {match.status}
        </Badge>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        <div className={`text-sm p-1 rounded ${match.winner === player1Name ? 'bg-success/20 font-bold' : ''}`}>
          {player1Name}
          {match.player1?.handicap && ` (${match.player1.handicap})`}
        </div>
        <div className="text-xs text-center text-muted-foreground">gegen</div>
        <div className={`text-sm p-1 rounded ${match.winner === player2Name ? 'bg-success/20 font-bold' : ''}`}>
          {player2Name}
          {match.player2?.handicap && ` (${match.player2.handicap})`}
        </div>
        {match.winner && (
          <div className="text-xs text-center text-success font-semibold mt-1">
            Gewinner: {match.winner}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const nodeTypes = {
  match: MatchNode,
};

export const TournamentBracketFlow: React.FC<TournamentBracketFlowProps> = ({
  tournamentId,
  matches,
  players,
  onMatchSelect
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Group matches by round
  const matchesByRound = useMemo(() => {
    const grouped: { [round: string]: Match[] } = {};
    matches.forEach(match => {
      if (!grouped[match.round]) {
        grouped[match.round] = [];
      }
      grouped[match.round].push(match);
    });
    return grouped;
  }, [matches]);

  // Define round order for proper layout - use standard numbering
  const roundOrder = ['Runde 1', 'Runde 2', 'Runde 3', 'Runde 4'];

  useEffect(() => {
    // Create nodes for matches
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let xOffset = 0;
    const roundSpacing = 300;
    const matchSpacing = 100;

    roundOrder.forEach((roundName, roundIndex) => {
      const roundMatches = matchesByRound[roundName] || [];
      
      if (roundMatches.length === 0) return;

      const yStart = -(roundMatches.length * matchSpacing) / 2;

      roundMatches.forEach((match, matchIndex) => {
        const yPosition = yStart + (matchIndex * matchSpacing);
        
        newNodes.push({
          id: match.id,
          type: 'match',
          position: { x: xOffset, y: yPosition },
          data: { 
            match, 
            onSelect: onMatchSelect 
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });

        // Create edges to next round matches
        if (match.nextMatchId) {
          newEdges.push({
            id: `${match.id}-${match.nextMatchId}`,
            source: match.id,
            target: match.nextMatchId,
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
            },
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
          });
        }
      });

      xOffset += roundSpacing;
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [matchesByRound, onMatchSelect]);

  return (
    <div className="h-96 w-full border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-background"
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};