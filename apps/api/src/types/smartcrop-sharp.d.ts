declare module "smartcrop-sharp" {
  export interface CropResult {
    topCrop: {
      x: number;
      y: number;
      width: number;
      height: number;
      score: {
        detail: number;
        saturation: number;
        skin: number;
        boost: number;
        total: number;
      };
    };
  }

  export interface CropOptions {
    width: number;
    height: number;
    minScale?: number;
    ruleOfThirds?: boolean;
  }

  export function crop(
    input: Buffer | string,
    options: CropOptions
  ): Promise<CropResult>;

  const smartcrop: {
    crop: typeof crop;
  };

  export default smartcrop;
}

