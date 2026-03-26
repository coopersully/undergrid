import type { Train } from "@undergrid/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.ts";

const POLL_INTERVAL = 30_000;

export function useTrains(city: string) {
	const [trains, setTrains] = useState<Train[]>([]);
	const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

	const fetchTrains = useCallback(async () => {
		try {
			const data = await api.getTrains(city);
			setTrains(data.trains);
		} catch {
			// retry on next poll
		}
	}, [city]);

	useEffect(() => {
		fetchTrains();
		intervalRef.current = setInterval(fetchTrains, POLL_INTERVAL);
		return () => clearInterval(intervalRef.current);
	}, [fetchTrains]);

	return trains;
}
