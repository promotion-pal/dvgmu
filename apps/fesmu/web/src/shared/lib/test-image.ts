import { ENV } from "@/shared/config/env";

/** A test question's picture, served by the api (stored in the files
 * service, tests/images); open without a login. */
export const testImageUrl = (hash: string) => `${ENV.API}/test-images/${hash}`;
