export namespace main {
	
	export class PipelineConfig {
	    videoUrl: string;
	    targetLang: string;
	    outputDir: string;
	    audioSettings: Record<string, any>;
	    textRules: any[];
	    segmentRules: any[];
	
	    static createFrom(source: any = {}) {
	        return new PipelineConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.videoUrl = source["videoUrl"];
	        this.targetLang = source["targetLang"];
	        this.outputDir = source["outputDir"];
	        this.audioSettings = source["audioSettings"];
	        this.textRules = source["textRules"];
	        this.segmentRules = source["segmentRules"];
	    }
	}
	export class VoiceRequest {
	    model: string;
	    voice: string;
	    input: string;
	    response_format: string;
	    speed: number;
	    lang_code: string;
	
	    static createFrom(source: any = {}) {
	        return new VoiceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.input = source["input"];
	        this.response_format = source["response_format"];
	        this.speed = source["speed"];
	        this.lang_code = source["lang_code"];
	    }
	}

}

