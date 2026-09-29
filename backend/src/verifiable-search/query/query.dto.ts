import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export const SIMULATED_ATTACKS = ['hide', 'centroid', 'tamper', 'rollback'] as const;
export type SimulatedAttack = (typeof SIMULATED_ATTACKS)[number];

export class VerifiableSearchDto {
  @IsString()
  @MinLength(1)
  query: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  k: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  nprobe: number;

  /** Test environments only: make the server misbehave so the client's detection can be shown. */
  @IsOptional()
  @IsIn(SIMULATED_ATTACKS)
  attack?: SimulatedAttack;
}
