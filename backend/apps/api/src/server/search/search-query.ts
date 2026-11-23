/**
 * Search as the API serves it: the domain query plus the app's search
 * sources (courses, community posts, certificates).
 *
 * QA review 1 C9, review 2 C4: learner search returned nothing for published
 * courses although the worker had indexed them. The sources register
 * themselves when search-source-adapters is imported, and only the worker
 * imported it; the API process answering /api/v1/search had none, so every
 * index entry was dropped as having no source. Routes take querySearch from
 * here, never straight from the domain package.
 */
import "./search-source-adapters";

export { querySearch } from "@atlas/domain/search/search.service";
