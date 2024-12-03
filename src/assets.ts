/**
 * An expression importing an asset module of type `A`, like this:
 *
 *     import(`./my_module`)
 * @see {@link asset}
 */
export type ModuleImport<A> = Promise<{default: A}>;

interface AssetLoaderFunc<A> {
  (moduleImport: ModuleImport<A>): Promise<A>;
}

/**
 * A helper function for loading assets of any type.
 *
 * Usage example:
 *     const importedValue = await assets.asset(import("" + "./asset_file"));
 *
 * __Explanation__: For this to work and type-check correctly, the following requirements
 * must be met:
 *  - The TS compiler should treat this as a dynamic import, so that it doesn't check the imported
 *    file. For this reason, the asset file name is constructed as a string sum.
 *    In TS 5.6 this is treated as a dynamic import.
 *  - The build/bundle tool should treat this as a static import, so that it knows which file
 *    is referenced, and can make it accessible at runtime. For this reason, the import function
 *    needs to be called at the call-site (as opposed to passing just the asset file name to the
 *    asset function). In esbuild 0.24 this is treated as a static import, even with the string sum.
 *  - The build/bundle tool needs to be configured to make the asset file available at runtime.
 *    In esbuild there are various loaders available for this, notably for:
 *     - text files:
 *       [text](https://esbuild.github.io/content-types/#text)
 *     - binary files:
 *       [binary](https://esbuild.github.io/content-types/#binary)
 *       or
 *       [base64](https://esbuild.github.io/content-types/#base64)
 *     - JSON files:
 *       [json](https://esbuild.github.io/content-types/#json)
 *       or
 *       [copy](https://esbuild.github.io/content-types/#copy)
 *     - any files accessed by URL:
 *       [dataurl](https://esbuild.github.io/content-types/#dataurl)
 *       or
 *       [file](https://esbuild.github.io/content-types/#file)
 *
 * See also the typed versions of the asset function below.
 * @see https://esbuild.github.io/content-types/
 */
export async function asset<A>(moduleImport: ModuleImport<A>) {
  return (await moduleImport).default;
}

/**
 * Usage:
 *
 *     const myText = await assets.text(import("" + "./my_text.txt"));
 *
 * The appropriate esbuild CLI param: `--loader:.txt=text`
 * @see {@link asset}
 */
export const text: AssetLoaderFunc<string> = asset;

/**
 * Usage:
 *
 *     const myData = await assets.binary(import("" + "./my_data.data"));
 *
 * The appropriate esbuild CLI param: `--loader:.data=binary`
 * @see {@link asset}
 */
export const binary: AssetLoaderFunc<Uint8Array> = asset;

/**
 * Usage:
 *
 *     const myDataBase64 = await assets.base64(import("" + "./my_data.data"));
 *
 * The appropriate esbuild CLI param: `--loader:.data=base64`
 * @see {@link asset}
 */
export const base64: AssetLoaderFunc<string> = asset;

/**
 * Usage examples:
 *
 *     const urlOfMyImage = await assets.url(import("" + "./my_image.png"));
 *     const urlOfMyFont = await assets.url(import("" + "./fonts/my_font.woff2"));
 *
 * The appropriate esbuild CLI params:
 *  - To embed the assets as data URIs:
 *    `--loader:.png=dataurl --loader:.woff2=dataurl`
 *  - To obtain relative URLs and serve the asset files along with the code:
 *    `--loader:.png=file --loader:.woff2=file`
 * @see {@link asset}
 */
export const url: AssetLoaderFunc<string> = asset;
