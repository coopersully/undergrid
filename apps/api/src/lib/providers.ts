import type { TransitProvider } from "@undergrid/providers";
import { MockNycSubwayProvider } from "@undergrid/providers";

const providers: Record<string, TransitProvider> = {
	nyc: new MockNycSubwayProvider(),
};

export function getProvider(cityId: string): TransitProvider | undefined {
	return providers[cityId];
}

export function getCityIds(): string[] {
	return Object.keys(providers);
}
