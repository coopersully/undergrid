import { z } from "zod";

const Position = z.tuple([z.number(), z.number()]);

export const CitySchema = z.object({
	id: z.string(),
	name: z.string(),
	bounds: z.tuple([Position, Position]),
});

export const TrainSchema = z.object({
	id: z.string(),
	line: z.string(),
	direction: z.enum(["N", "S"]),
	position: Position,
	timestamp: z.number(),
});

export const StationSchema = z.object({
	id: z.string(),
	name: z.string(),
	lines: z.array(z.string()),
	position: Position,
});

export const ArrivalSchema = z.object({
	line: z.string(),
	direction: z.enum(["N", "S"]),
	arrival: z.number(),
});

export const CitiesResponseSchema = z.object({
	cities: z.array(CitySchema),
});

export const TrainsResponseSchema = z.object({
	city: z.string(),
	trains: z.array(TrainSchema),
	timestamp: z.number(),
});

export const StationsResponseSchema = z.object({
	city: z.string(),
	stations: z.array(StationSchema),
});

export const ArrivalsResponseSchema = z.object({
	station: z.string(),
	arrivals: z.array(ArrivalSchema),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

export type City = z.infer<typeof CitySchema>;
export type Train = z.infer<typeof TrainSchema>;
export type Station = z.infer<typeof StationSchema>;
export type Arrival = z.infer<typeof ArrivalSchema>;
export type CitiesResponse = z.infer<typeof CitiesResponseSchema>;
export type TrainsResponse = z.infer<typeof TrainsResponseSchema>;
export type StationsResponse = z.infer<typeof StationsResponseSchema>;
export type ArrivalsResponse = z.infer<typeof ArrivalsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
